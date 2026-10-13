import 'server-only'

/**
 * Envato API client. ENVATO_API_TOKEN is read from process.env on the server only, sent only in
 * the Authorization header, and never logged or put in an error message (errors name the
 * endpoint path, never the URL with its query or the header).
 */
export const ENVATO_API_BASE = 'https://api.envato.com'
const TIMEOUT_MS = 15_000
const MAX_BACKOFF_MS = 10 * 60_000

export type EnvatoSearchItem = {
  id: number
  name: string
  site?: string
  classification?: string
  price_cents?: number
  number_of_sales?: number
  author_username?: string
  url?: string
  published_at?: string
  updated_at?: string
  tags?: string[]
  rating?: { rating?: number; count?: number }
  previews?: {
    landscape_preview?: { landscape_url?: string }
    icon_with_landscape_preview?: { landscape_url?: string }
    live_site?: { url?: string }
  }
}
export type EnvatoSearchResult = { total_hits: number; matches: EnvatoSearchItem[] }
export type SearchQuery = {
  category: string
  priceMin?: number
  priceMax?: number | null
  page?: number
  pageSize?: number
}
export type ItemPrices = { regularCents: number | null; extendedCents: number | null }

export interface EnvatoApi {
  search(q: SearchQuery): Promise<EnvatoSearchResult>
  itemPrices(id: number): Promise<ItemPrices>
  readonly calls: number
}

export class EnvatoApiError extends Error {
  constructor(public readonly status: number, endpoint: string) {
    super(`Envato API HTTP ${status} on ${endpoint}`)
  }
}

export function envatoTokenConfigured(): boolean {
  return Boolean(process.env.ENVATO_API_TOKEN?.trim())
}

type Deps = {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  delayMs?: number
  now?: () => number
  token?: string
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function createEnvatoClient(deps: Deps = {}): EnvatoApi {
  const token = (deps.token ?? process.env.ENVATO_API_TOKEN ?? '').trim()
  if (!token) throw new Error('ENVATO_API_TOKEN is not set (server env only)')
  const fetchImpl = deps.fetchImpl ?? fetch
  const sleep = deps.sleep ?? realSleep
  const now = deps.now ?? Date.now
  const delayMs = deps.delayMs ?? 2500
  let last = -Infinity
  let calls = 0

  async function get(path: string, params: Record<string, string>, endpoint: string): Promise<unknown> {
    let backoff = 30_000
    for (;;) {
      const wait = last + delayMs - now()
      if (wait > 0) await sleep(wait)
      last = now()
      calls++
      const qs = new URLSearchParams(params).toString()
      let res: Response
      try {
        res = await fetchImpl(`${ENVATO_API_BASE}${path}${qs ? `?${qs}` : ''}`, {
          headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Freeplug template picker (admin sync)' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch {
        throw new Error(`Envato API network error on ${endpoint}`)
      }
      if (res.status === 429) {
        const ra = Number(res.headers.get('retry-after'))
        const ms = Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : backoff, MAX_BACKOFF_MS)
        if (backoff > MAX_BACKOFF_MS) throw new EnvatoApiError(429, endpoint)
        backoff *= 2
        await sleep(ms)
        continue
      }
      if (!res.ok) throw new EnvatoApiError(res.status, endpoint)
      return res.json()
    }
  }

  return {
    get calls() {
      return calls
    },
    async search(q) {
      const p: Record<string, string> = {
        site: 'themeforest.net',
        category: q.category,
        page: String(q.page ?? 1),
        page_size: String(q.pageSize ?? 100),
        sort_by: 'date',
        sort_direction: 'asc',
      }
      if (q.priceMin != null) p.price_min = String(q.priceMin)
      if (q.priceMax != null) p.price_max = String(q.priceMax)
      const j = (await get('/v1/discovery/search/search/item', p, 'search')) as Partial<EnvatoSearchResult>
      return { total_hits: Number(j.total_hits ?? 0), matches: Array.isArray(j.matches) ? j.matches : [] }
    },
    async itemPrices(id) {
      const j = (await get(`/v1/market/item-prices:${id}.json`, {}, 'item-prices')) as unknown
      return parseItemPrices(j)
    },
  }
}

function toCents(v: unknown): number | null {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.round(n * 100) : null
}

export function parseItemPrices(j: unknown): ItemPrices {
  const list = Array.isArray(j)
    ? j
    : Array.isArray((j as { 'item-prices'?: unknown })?.['item-prices'])
      ? (j as { 'item-prices': unknown[] })['item-prices']
      : []
  let regularCents: number | null = null
  let extendedCents: number | null = null
  for (const row of list as Array<{ licence?: string; license?: string; price?: string }>) {
    const name = (row.licence ?? row.license ?? '').toLowerCase()
    if (name.startsWith('regular')) regularCents = toCents(row.price)
    if (name.startsWith('extended')) extendedCents = toCents(row.price)
  }
  return { regularCents, extendedCents }
}
