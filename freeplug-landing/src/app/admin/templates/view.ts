import { isNiche, type Niche } from '@/lib/envato/niche-tags'

export const FRESH_HOURS = 6
export const MIN_PER_TYPE = 6
export type View = 'shortlist' | 'catalog' | 'general' | 'needs-lina'

export type Filters = {
  niche: Niche | null
  view: View
  platform: 'html' | 'wp' | null
  category: string | null
  maxPrice: number | null
  minRating: number | null
  minSales: number | null
  updatedDays: number | null
  msg: string | null
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null
const num = (v: string | string[] | undefined) => {
  const s = one(v)
  if (s == null) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const MSGS: Record<string, string> = {
  'no-token': 'ENVATO_API_TOKEN is not set in the server env.',
  'sync-running': 'A sync is already running.',
  'sync-started': 'Sync started (about 2.5 s between calls; a full sweep takes several minutes). Reload to see progress.',
  'reason-required': 'A reason is required to widen.',
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const n = one(sp.niche)
  const v = one(sp.view)
  const p = one(sp.platform)
  const rawMsg = one(sp.msg)
  let msg: string | null = rawMsg ? MSGS[rawMsg] ?? null : null
  const imp = rawMsg && /^imported-(\d+)-(\d+)-(\d+)-(\d+)$/.exec(rawMsg)
  if (imp) msg = `Imported ${imp[1]} picks: ${imp[2]} confirmed, ${imp[3]} cut, ${imp[4]} unverified.`
  return {
    niche: isNiche(n) ? n : null,
    view: v === 'catalog' || v === 'general' || v === 'needs-lina' ? v : 'shortlist',
    platform: p === 'html' || p === 'wp' ? p : null,
    category: one(sp.category),
    maxPrice: num(sp.maxPrice),
    minRating: num(sp.minRating),
    minSales: num(sp.minSales),
    updatedDays: num(sp.updatedDays),
    msg,
  }
}

export function formatCents(c: number | null | undefined): string {
  return c == null ? '—' : `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`
}

export function isoHoursAgo(hours: number, now: number = Date.now()): string {
  return new Date(now - hours * 3600_000).toISOString()
}
