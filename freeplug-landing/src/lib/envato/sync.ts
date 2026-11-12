import { createHash } from 'node:crypto'
import type { EnvatoApi, EnvatoSearchItem } from './client'
import { CORE_CATEGORIES, pagesFor, planPartitions, PAGE_SIZE, type Partition } from './partitions'
import { autoNiches, classifyCleaning } from './niche-tags'
import type { CatalogItem, CatalogStore, Decision, RunSummary } from './store'

export const SYNC_DELAY_MS = 2500
const SEEN_BATCH = 500

export function itemFromApi(m: EnvatoSearchItem, category: string, decisions: Decision[]): CatalogItem {
  const tags = (m.tags ?? []).map(String)
  const cls = m.classification ?? category
  const platform: 'html' | 'wp' = cls.startsWith('wordpress') ? 'wp' : 'html'
  const cleaning = classifyCleaning({ name: m.name, tags })
  const decided = decisions.find((d) => d.envato_item_id === m.id && d.niche === 'cleaning')
  let niches = autoNiches({ name: m.name, tags })
  // Lina's decision overrides the tagger (card): yes adds, no removes.
  if (decided?.decision === 'yes' && !niches.includes('cleaning')) niches = [...niches, 'cleaning']
  if (decided?.decision === 'no') niches = niches.filter((n) => n !== 'cleaning')
  const needsLina = cleaning.kind === 'flag' && !decided
  const base = {
    id: m.id,
    site: m.site ?? 'themeforest.net',
    category: cls,
    platform,
    name: m.name,
    author: m.author_username ?? null,
    url: m.url ?? null,
    price_cents: m.price_cents ?? null,
    rating: m.rating?.rating ?? null,
    rating_count: m.rating?.count ?? null,
    sales: m.number_of_sales ?? null,
    published_at: m.published_at ?? null,
    updated_at: m.updated_at ?? null,
    live_preview_url: m.previews?.live_site?.url ?? null,
    preview_image_url:
      m.previews?.landscape_preview?.landscape_url ?? m.previews?.icon_with_landscape_preview?.landscape_url ?? null,
    tags,
    auto_niches: niches,
    cleaning_match: cleaning.kind === 'none' ? null : cleaning.matchedTag,
    needs_lina: needsLina,
  }
  const content_hash = createHash('sha256').update(JSON.stringify(base)).digest('hex').slice(0, 32)
  return { ...base, content_hash }
}

export type SyncOptions = {
  api: EnvatoApi
  store: CatalogStore
  categories?: readonly string[]
  /** Stop early (incomplete run: nothing gets marked removed). */
  maxCalls?: number
  withExtendedPrices?: boolean
  now?: () => Date
  log?: (line: string) => void
}

export type SyncResult = RunSummary & { runId: number; perCategory: Record<string, number>; partitionList: Partition[] }

/** One sweep. Pacing (2.5 s between calls) lives in the client. Removed-marking only after a complete sweep. */
export async function syncCatalog(o: SyncOptions): Promise<SyncResult> {
  const now = o.now ?? (() => new Date())
  const log = o.log ?? (() => {})
  const categories = o.categories ?? CORE_CATEGORIES
  const runId = await o.store.startRun()
  const decisions = await o.store.decisions()
  const perCategory: Record<string, number> = {}
  const seen = new Set<number>()
  let changed = 0
  let partitions: Partition[] = []
  let complete = false
  let error: string | null = null
  const budget = () => o.maxCalls != null && o.api.calls >= o.maxCalls
  try {
    partitions = await planPartitions(categories, async (q) => (await o.api.search({ ...q, page: 1, pageSize: 1 })).total_hits)
    log(`planned ${partitions.length} partitions`)
    outer: for (const p of partitions) {
      for (let page = 1; page <= pagesFor(p.total); page++) {
        if (budget()) break outer
        const r = await o.api.search({ category: p.category, priceMin: p.priceMin, priceMax: p.priceMax, page, pageSize: PAGE_SIZE })
        const items = r.matches.map((m) => itemFromApi(m, p.category, decisions))
        const fresh = items.filter((i) => !seen.has(i.id))
        fresh.forEach((i) => seen.add(i.id))
        perCategory[p.category] = (perCategory[p.category] ?? 0) + fresh.length
        const old = await o.store.hashes(fresh.map((i) => i.id))
        const diff = fresh.filter((i) => old.get(i.id) !== i.content_hash)
        const seenAt = now().toISOString()
        if (diff.length) await o.store.upsertItems(diff, runId, seenAt)
        const same = fresh.filter((i) => old.get(i.id) === i.content_hash).map((i) => i.id)
        for (let k = 0; k < same.length; k += SEEN_BATCH) await o.store.markSeen(same.slice(k, k + SEEN_BATCH), runId, seenAt)
        changed += diff.length
        if (r.matches.length < PAGE_SIZE) break
      }
      log(`${p.category}${p.priceMin != null ? ` $${p.priceMin}-${p.priceMax ?? ''}` : ''}: ${p.total} hits`)
    }
    complete = !budget()
    if (o.withExtendedPrices !== false && complete) {
      for (const id of await o.store.shortlistIds()) {
        if (o.maxCalls != null && o.api.calls >= o.maxCalls) break
        try {
          const pr = await o.api.itemPrices(id)
          await o.store.setPrices(id, pr.regularCents, pr.extendedCents)
        } catch (e) {
          log(`prices ${id}: ${e instanceof Error ? e.message : 'error'}`)
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'sync error'
    complete = false
  }
  const removed = complete ? await o.store.markRemovedExcept(runId) : 0
  const summary: RunSummary = {
    partitions: partitions.map((p) => ({ ...p })),
    calls: o.api.calls,
    items_seen: seen.size,
    items_changed: changed,
    items_removed: removed,
    complete,
    error,
  }
  await o.store.finishRun(runId, summary)
  return { ...summary, runId, perCategory, partitionList: partitions }
}
