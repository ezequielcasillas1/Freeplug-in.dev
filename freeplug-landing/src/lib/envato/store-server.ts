import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CatalogItem, CatalogStore, Decision, RunSummary, ShortlistRow } from './store'

/** Supabase adapter (service-role client only; the tables grant nothing to anon/authenticated). */
export class SupabaseCatalogStore implements CatalogStore {
  constructor(private readonly db: SupabaseClient) {}
  private check<T>(r: { data: T; error: { message: string } | null }): T {
    if (r.error) throw new Error(`catalog store: ${r.error.message}`)
    return r.data
  }
  async startRun() {
    const d = this.check(await this.db.from('envato_sync_runs').insert({}).select('id').single())
    return Number((d as { id: number }).id)
  }
  async finishRun(id: number, s: RunSummary) {
    this.check(await this.db.from('envato_sync_runs').update({ ...s, finished_at: new Date().toISOString() }).eq('id', id))
  }
  async hashes(ids: number[]) {
    if (!ids.length) return new Map<number, string>()
    const d = this.check(await this.db.from('envato_items').select('id, content_hash').in('id', ids)) as Array<{ id: number; content_hash: string }>
    return new Map(d.map((r) => [Number(r.id), r.content_hash]))
  }
  async upsertItems(items: CatalogItem[], runId: number, seenAt: string) {
    const rows = items.map((i) => ({ ...i, last_seen_run_id: runId, last_seen_at: seenAt, status: 'active' }))
    this.check(await this.db.from('envato_items').upsert(rows, { onConflict: 'id' }))
  }
  async markSeen(ids: number[], runId: number, seenAt: string) {
    if (!ids.length) return
    this.check(await this.db.from('envato_items').update({ last_seen_run_id: runId, last_seen_at: seenAt, status: 'active' }).in('id', ids))
  }
  async markRemovedExcept(runId: number) {
    const d = this.check(
      await this.db.from('envato_items').update({ status: 'removed' }).eq('status', 'active').neq('last_seen_run_id', runId).select('id'),
    ) as unknown[]
    return d.length
  }
  async decisions() {
    return this.check(await this.db.from('template_niche_decisions').select('envato_item_id, niche, decision')) as Decision[]
  }
  async shortlistIds() {
    const d = this.check(await this.db.from('template_shortlist').select('envato_item_id').eq('active', true)) as Array<{ envato_item_id: number }>
    return [...new Set(d.map((r) => Number(r.envato_item_id)))]
  }
  async setPrices(id: number, regular: number | null, extended: number | null) {
    const patch: Record<string, number | null> = { extended_price_cents: extended }
    if (regular != null) patch.price_cents = regular
    this.check(await this.db.from('envato_items').update(patch).eq('id', id))
    this.check(
      await this.db
        .from('template_shortlist')
        .update({ regular_price_cents: regular, extended_price_cents: extended, prices_checked_at: new Date().toISOString() })
        .eq('envato_item_id', id),
    )
  }
  async upsertShortlist(rows: ShortlistRow[]) {
    const stamped = rows.map((r) => ({ ...r, imported_at: new Date().toISOString() }))
    this.check(await this.db.from('template_shortlist').upsert(stamped, { onConflict: 'envato_item_id,niche' }))
  }
  async deactivateShortlistExcept(keys: Array<{ envato_item_id: number; niche: string }>) {
    const keep = new Set(keys.map((k) => `${k.envato_item_id}|${k.niche}`))
    const d = this.check(await this.db.from('template_shortlist').select('envato_item_id, niche').eq('active', true)) as Array<{ envato_item_id: number; niche: string }>
    const drop = d.filter((r) => !keep.has(`${r.envato_item_id}|${r.niche}`))
    for (const r of drop) {
      this.check(await this.db.from('template_shortlist').update({ active: false }).eq('envato_item_id', r.envato_item_id).eq('niche', r.niche))
    }
    return drop.length
  }
  /** Lina's Cleaning / Not cleaning. Stored first, then applied to the item so it leaves Needs Lina. */
  async decide(d: Decision & { matched_tag: string | null; decided_by: string }) {
    this.check(await this.db.from('template_niche_decisions').upsert({ ...d, decided_at: new Date().toISOString() }, { onConflict: 'envato_item_id,niche' }))
    const cur = this.check(await this.db.from('envato_items').select('auto_niches').eq('id', d.envato_item_id).maybeSingle()) as { auto_niches: string[] } | null
    if (cur) {
      const set = new Set(cur.auto_niches ?? [])
      if (d.decision === 'yes') set.add(d.niche)
      else set.delete(d.niche)
      this.check(await this.db.from('envato_items').update({ auto_niches: [...set], needs_lina: false }).eq('id', d.envato_item_id))
    }
  }
}
