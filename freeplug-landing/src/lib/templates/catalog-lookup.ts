import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The ONE place the customer picker reads the Envato catalog (envato_items, synced by the admin
 * picker on envato-picker-admin). TODO: to be repointed to Cloudflare D1 (binding ENVATO_DB) later;
 * keep every catalog read for the customer flow behind these two functions so that swap is one file.
 */
export const CATALOG_FRESH_HOURS = 6

export type CatalogCard = {
  id: number
  name: string
  previewImageUrl: string | null
  livePreviewUrl: string | null
  url: string | null
  autoNiches: string[]
  lastSeenAt: string | null
  status: string
}

type Row = {
  id: number | string
  name: string
  preview_image_url: string | null
  live_preview_url: string | null
  url: string | null
  auto_niches: string[] | null
  last_seen_at: string | null
  status: string
}
const COLS = 'id, name, preview_image_url, live_preview_url, url, auto_niches, last_seen_at, status'

function toCard(r: Row): CatalogCard {
  return {
    id: Number(r.id),
    name: r.name,
    previewImageUrl: r.preview_image_url,
    livePreviewUrl: r.live_preview_url,
    url: r.url,
    autoNiches: r.auto_niches ?? [],
    lastSeenAt: r.last_seen_at,
    status: r.status,
  }
}

/** True when the item is active and was last seen by a sync under 6 hours ago. */
export function isFresh(c: Pick<CatalogCard, 'status' | 'lastSeenAt'>, now: number = Date.now()): boolean {
  if (c.status !== 'active' || !c.lastSeenAt) return false
  const t = Date.parse(c.lastSeenAt)
  return Number.isFinite(t) && now - t < CATALOG_FRESH_HOURS * 3600_000 && t <= now + 60_000
}

/** Catalog lookup for one item (service-role client). null = not in the catalog. */
export async function lookupCatalogItem(db: SupabaseClient, id: number): Promise<CatalogCard | null> {
  const { data, error } = await db.from('envato_items').select(COLS).eq('id', id).maybeSingle()
  if (error) throw new Error('catalog lookup failed')
  return data ? toCard(data as Row) : null
}

function dedupe(rows: Row[]): CatalogCard[] {
  const seen = new Set<number>()
  const out: CatalogCard[] = []
  for (const r of rows) {
    const c = toCard(r)
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}

/** Active items tagged for a business type, best sellers first, each id once. */
export async function listCatalogForType(db: SupabaseClient, niche: string, limit = 60): Promise<CatalogCard[]> {
  const { data, error } = await db
    .from('envato_items')
    .select(COLS)
    .eq('status', 'active')
    .contains('auto_niches', [niche])
    .order('sales', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(limit)
  if (error) throw new Error('catalog list failed')
  return dedupe((data ?? []) as Row[])
}

/**
 * Active "general" items (Aria rule 1: no specific niche, i.e. auto_niches null/empty or only
 * other_local), best sellers first. Shown to the customer only when a widen applies to the request.
 */
export async function listGeneralCatalog(db: SupabaseClient, limit = 60): Promise<CatalogCard[]> {
  const { data, error } = await db
    .from('envato_items')
    .select(COLS)
    .eq('status', 'active')
    .or('auto_niches.is.null,auto_niches.eq.{},auto_niches.eq.{other_local}')
    .order('sales', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(limit)
  if (error) throw new Error('catalog list failed')
  return dedupe((data ?? []) as Row[])
}
