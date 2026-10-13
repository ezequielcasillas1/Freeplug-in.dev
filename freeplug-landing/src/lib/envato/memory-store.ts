import type { CatalogItem, CatalogStore, Decision, RunSummary, ShortlistRow } from './store'

type Row = CatalogItem & { last_seen_run_id: number; last_seen_at: string; status: 'active' | 'removed'; extended_price_cents: number | null }

/** In-memory CatalogStore with the same semantics as the Supabase adapter (tests, dry runs). */
export class MemoryCatalogStore implements CatalogStore {
  items = new Map<number, Row>()
  runs: Array<{ id: number } & Partial<RunSummary>> = []
  shortlist = new Map<string, ShortlistRow>()
  decisionRows: Decision[] = []
  async startRun() {
    const id = this.runs.length + 1
    this.runs.push({ id })
    return id
  }
  async finishRun(id: number, s: RunSummary) {
    Object.assign(this.runs[id - 1], s)
  }
  async hashes(ids: number[]) {
    return new Map(ids.filter((i) => this.items.has(i)).map((i) => [i, this.items.get(i)!.content_hash]))
  }
  async upsertItems(items: CatalogItem[], runId: number, seenAt: string) {
    for (const i of items) {
      const prev = this.items.get(i.id)
      this.items.set(i.id, { ...i, extended_price_cents: prev?.extended_price_cents ?? null, last_seen_run_id: runId, last_seen_at: seenAt, status: 'active' })
    }
  }
  async markSeen(ids: number[], runId: number, seenAt: string) {
    for (const id of ids) Object.assign(this.items.get(id)!, { last_seen_run_id: runId, last_seen_at: seenAt, status: 'active' })
  }
  async markRemovedExcept(runId: number) {
    let n = 0
    for (const r of this.items.values()) if (r.status === 'active' && r.last_seen_run_id !== runId) { r.status = 'removed'; n++ }
    return n
  }
  async decisions() {
    return [...this.decisionRows]
  }
  async shortlistIds() {
    return [...new Set([...this.shortlist.values()].filter((r) => r.active).map((r) => r.envato_item_id))]
  }
  async setPrices(id: number, regular: number | null, extended: number | null) {
    const r = this.items.get(id)
    if (r) Object.assign(r, { price_cents: regular ?? r.price_cents, extended_price_cents: extended })
  }
  async upsertShortlist(rows: ShortlistRow[]) {
    for (const r of rows) this.shortlist.set(`${r.envato_item_id}|${r.niche}`, { ...r })
  }
  async deactivateShortlistExcept(keys: Array<{ envato_item_id: number; niche: string }>) {
    const keep = new Set(keys.map((k) => `${k.envato_item_id}|${k.niche}`))
    let n = 0
    for (const [k, r] of this.shortlist) if (!keep.has(k) && r.active) { r.active = false; n++ }
    return n
  }
  decide(d: Decision) {
    this.decisionRows = this.decisionRows.filter((x) => !(x.envato_item_id === d.envato_item_id && x.niche === d.niche))
    this.decisionRows.push(d)
    const r = this.items.get(d.envato_item_id)
    if (r && d.niche === 'cleaning') {
      r.needs_lina = false
      r.auto_niches = d.decision === 'yes' ? [...new Set([...r.auto_niches, 'cleaning'])] : r.auto_niches.filter((n) => n !== 'cleaning')
    }
  }
}
