import type { CatalogStore, ShortlistRow } from './store'
import { isNiche } from './niche-tags'

type RawPick = Record<string, unknown> & { name?: string; url?: string; verify_status?: string }

export function itemIdFromUrl(url: string): number | null {
  const m = /\/(\d{5,})(?:[/?#]|$)/.exec(url)
  return m ? Number(m[1]) : null
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)

/** Map Lina's JSON ({types: {niche: picks[]}}) to shortlist rows, keyed (item id, niche). */
export function shortlistRowsFromJson(json: unknown, sourceFile: string): { rows: ShortlistRow[]; skipped: string[] } {
  const types = (json as { types?: Record<string, RawPick[]> })?.types ?? {}
  const rows = new Map<string, ShortlistRow>()
  const skipped: string[] = []
  for (const [niche, picks] of Object.entries(types)) {
    if (!isNiche(niche) || !Array.isArray(picks)) {
      skipped.push(`type ${niche}`)
      continue
    }
    for (const p of picks) {
      const url = str(p.url)
      const id = url ? itemIdFromUrl(url) : null
      const vs = p.verify_status
      if (!url || id == null || (vs !== 'confirmed' && vs !== 'cut' && vs !== 'unverified')) {
        skipped.push(`${niche}: ${String(p.name)}`)
        continue
      }
      rows.set(`${id}|${niche}`, {
        envato_item_id: id,
        niche,
        name: String(p.name ?? ''),
        url,
        demo_url: str(p.demo_url),
        platform: str(p.platform),
        verify_status: vs,
        verify_reason: str(p.verify_reason),
        build_note: str(p.build_note),
        note: str(p.note),
        source_file: sourceFile,
        raw: p,
        active: true,
      })
    }
  }
  return { rows: [...rows.values()], skipped }
}

/** Idempotent: upsert on (item, niche); picks dropped from a newer file go inactive. Decisions are untouched. */
export async function importShortlist(store: CatalogStore, json: unknown, sourceFile: string) {
  const { rows, skipped } = shortlistRowsFromJson(json, sourceFile)
  await store.upsertShortlist(rows)
  const deactivated = await store.deactivateShortlistExcept(rows.map((r) => ({ envato_item_id: r.envato_item_id, niche: r.niche })))
  const counts = { confirmed: 0, cut: 0, unverified: 0 }
  rows.forEach((r) => counts[r.verify_status]++)
  return { imported: rows.length, counts, skipped, deactivated }
}
