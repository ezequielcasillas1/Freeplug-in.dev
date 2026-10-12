/** Storage port for the catalog. Supabase adapter: store-server.ts. In-memory adapter: memory-store.ts (tests). */
export type CatalogItem = {
  id: number
  site: string
  category: string
  platform: 'html' | 'wp'
  name: string
  author: string | null
  url: string | null
  price_cents: number | null
  rating: number | null
  rating_count: number | null
  sales: number | null
  published_at: string | null
  updated_at: string | null
  live_preview_url: string | null
  preview_image_url: string | null
  tags: string[]
  auto_niches: string[]
  cleaning_match: string | null
  needs_lina: boolean
  content_hash: string
}

export type ShortlistRow = {
  envato_item_id: number
  niche: string
  name: string
  url: string
  demo_url: string | null
  platform: string | null
  verify_status: 'confirmed' | 'cut' | 'unverified'
  verify_reason: string | null
  build_note: string | null
  note: string | null
  source_file: string
  raw: Record<string, unknown>
  active: boolean
}

export type Decision = { envato_item_id: number; niche: string; decision: 'yes' | 'no' }

export type RunSummary = {
  partitions: unknown[]
  calls: number
  items_seen: number
  items_changed: number
  items_removed: number
  complete: boolean
  error: string | null
}

export interface CatalogStore {
  startRun(): Promise<number>
  finishRun(runId: number, s: RunSummary): Promise<void>
  /** Existing content hashes for these ids. */
  hashes(ids: number[]): Promise<Map<number, string>>
  upsertItems(items: CatalogItem[], runId: number, seenAt: string): Promise<void>
  markSeen(ids: number[], runId: number, seenAt: string): Promise<void>
  /** Active items not seen in this run become removed. Returns the count. */
  markRemovedExcept(runId: number): Promise<number>
  decisions(): Promise<Decision[]>
  shortlistIds(): Promise<number[]>
  setPrices(id: number, regular: number | null, extended: number | null): Promise<void>
  upsertShortlist(rows: ShortlistRow[]): Promise<void>
  deactivateShortlistExcept(keys: Array<{ envato_item_id: number; niche: string }>): Promise<number>
}
