import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { classifyCleaning, autoNiches } from './niche-tags'
import { planPartitions, RESULT_CAP } from './partitions'
import { createEnvatoClient, parseItemPrices, type EnvatoApi, type EnvatoSearchItem } from './client'
import { MemoryCatalogStore } from './memory-store'
import { syncCatalog, SYNC_DELAY_MS } from './sync'
import { importShortlist, itemIdFromUrl, shortlistRowsFromJson } from './shortlist-import'
import { envatoCronEnabled, runScheduledEnvatoSync, ENVATO_CRON } from './scheduled'
import { isLocalhostRequest } from '@/lib/admin/localhost-only'
import { formatCents, parseFilters } from '@/app/admin/templates/view'

const APP = path.resolve(__dirname, '../../..')
const FAKE_TOKEN = 'tok_SECRET_do_not_leak_1234567890ab'

function hdrs(h: Record<string, string>) {
  const m = new Map(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]))
  return { get: (n: string) => m.get(n.toLowerCase()) ?? null }
}

describe('cleaning tagger: whole words only', () => {
  it('tags maid service / housekeeping / cleaners', () => {
    expect(classifyCleaning({ name: 'Maidy - Maid Service HTML', tags: [] }).kind).toBe('cleaning')
    expect(classifyCleaning({ name: 'Cleanex', tags: ['cleaning company'] })).toEqual({ kind: 'cleaning', matchedTag: 'cleaning' })
    expect(classifyCleaning({ name: 'Brite', tags: ['cleaners'] }).kind).toBe('cleaning')
    expect(autoNiches({ name: 'Janitorial Pro', tags: [] })).toContain('cleaning')
  })
  it('never matches clean alone, design wording or substrings', () => {
    for (const name of ['Clean - Minimal Business Template', 'Cleanly corporate', 'Unclean', 'Cleaningstar', 'Maiden voyage agency']) {
      expect(classifyCleaning({ name, tags: [] }).kind, name).toBe('none')
    }
    expect(classifyCleaning({ name: 'Agency', tags: ['clean design', 'clean code', 'clean layout'] }).kind).toBe('none')
    expect(autoNiches({ name: 'Clean Corporate', tags: ['clean'] })).not.toContain('cleaning')
  })
  it('flags hotel-style housekeeping for Lina and keeps the cleaning tag until she decides', () => {
    const r = classifyCleaning({ name: 'Luxury Hotel & Resort', tags: ['housekeeping', 'hotel'] })
    expect(r).toMatchObject({ kind: 'flag', matchedTag: 'housekeeping', coTag: 'hotel' })
    expect(autoNiches({ name: 'Luxury Hotel & Resort', tags: ['housekeeping', 'hotel'] })).toContain('cleaning')
    expect(classifyCleaning({ name: 'Home Housekeeping Services', tags: [] }).kind).toBe('cleaning')
  })
  for (const term of ['house cleaning', 'maid service', 'housekeeping', 'cleaning service', 'home cleaning', 'janitorial']) {
    for (const co of ['hotel', 'hostel', 'resort', 'motel', 'booking']) {
      it(`flags "${term}" + "${co}"`, () => {
        const r = classifyCleaning({ name: 'Theme X', tags: [term, co] })
        expect(r).toMatchObject({ kind: 'flag', matchedTag: term, coTag: co })
        expect(autoNiches({ name: 'Theme X', tags: [term, co] })).toContain('cleaning')
      })
    }
  }
  it('flag needs whole words on both sides, and one of the six terms (not maid/cleaning alone)', () => {
    expect(classifyCleaning({ name: 'T', tags: ['cleaning service', 'bookings'] }).kind).toBe('cleaning')
    expect(classifyCleaning({ name: 'T', tags: ['cleaning service', 'hotelier'] }).kind).toBe('cleaning')
    expect(classifyCleaning({ name: 'T', tags: ['housekeepings', 'hotel'] }).kind).toBe('none')
    expect(classifyCleaning({ name: 'T', tags: ['maid', 'hotel'] }).kind).toBe('cleaning')
    expect(classifyCleaning({ name: 'T', tags: ['cleaning', 'booking'] }).kind).toBe('cleaning')
    expect(classifyCleaning({ name: 'Grand Hotel', tags: ['booking'] }).kind).toBe('none')
  })
  it('a flagged template sits in Needs Lina after sync, keeps the tag, and leaves after her decision', async () => {
    const store = new MemoryCatalogStore()
    const rows = [item(8, 'Queak - Cleaning Service', ['booking'])]
    await syncCatalog({ api: fakeApi({ c: rows }), store, categories: ['c'], withExtendedPrices: false })
    expect(store.items.get(8)!.needs_lina).toBe(true)
    expect(store.items.get(8)!.auto_niches).toContain('cleaning')
    store.decide({ envato_item_id: 8, niche: 'cleaning', decision: 'no' })
    await syncCatalog({ api: fakeApi({ c: rows.map((r) => ({ ...r, number_of_sales: 3 })) }), store, categories: ['c'], withExtendedPrices: false })
    expect(store.items.get(8)!.needs_lina).toBe(false)
    expect(store.items.get(8)!.auto_niches).not.toContain('cleaning')
  })
})

describe('partitions: price split only over 6,000', () => {
  it('one count per category under the cap, no price split', async () => {
    const count = vi.fn(async () => 1070)
    const p = await planPartitions(['site-templates/retail/health-beauty'], count)
    expect(p).toEqual([{ category: 'site-templates/retail/health-beauty', total: 1070 }])
    expect(count).toHaveBeenCalledTimes(1)
  })
  it('exactly 6,000 is not split', async () => {
    const p = await planPartitions(['x'], async () => RESULT_CAP)
    expect(p).toHaveLength(1)
  })
  it('splits the 6,042 category into Aria’s bands and halves a band still over', async () => {
    const p = await planPartitions(['site-templates/corporate/business'], async (q) => {
      if (q.priceMin == null) return 6042
      if (q.priceMin === 0 && q.priceMax === 15) return 2084
      if (q.priceMin === 16 && q.priceMax === 20) return 2436
      if (q.priceMin === 21 && q.priceMax == null) return 7000
      return 3000
    })
    expect(p.map((x) => [x.priceMin, x.priceMax])).toEqual([[0, 15], [16, 20], [21, 41], [42, null]])
    expect(p.every((x) => x.total <= RESULT_CAP)).toBe(true)
  })
})

function fakeFetch(responder: (url: URL) => { status: number; body?: unknown; headers?: Record<string, string> }) {
  return vi.fn(async (input: string | URL | Request) => {
    const u = new URL(String(input))
    const r = responder(u)
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: r.headers })
  }) as unknown as typeof fetch
}

describe('Envato client', () => {
  it('waits ~2.5 s between calls', async () => {
    let t = 0
    const sleeps: number[] = []
    const api = createEnvatoClient({
      token: FAKE_TOKEN,
      now: () => t,
      sleep: async (ms) => { sleeps.push(ms); t += ms },
      fetchImpl: fakeFetch(() => ({ status: 200, body: { total_hits: 1, matches: [] } })),
    })
    await api.search({ category: 'a' })
    await api.search({ category: 'a' })
    await api.search({ category: 'a' })
    expect(SYNC_DELAY_MS).toBe(2500)
    expect(sleeps).toEqual([2500, 2500])
  })
  it('sends the token only in the Authorization header, never in the URL', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { total_hits: 0, matches: [] } }))
    const api = createEnvatoClient({ token: FAKE_TOKEN, delayMs: 0, fetchImpl: f })
    await api.search({ category: 'wordpress/real-estate', priceMin: 16, priceMax: 20 })
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).not.toContain(FAKE_TOKEN)
    expect(String(url)).toContain('price_min=16')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${FAKE_TOKEN}` })
  })
  it('honors Retry-After on 429', async () => {
    let n = 0
    const sleeps: number[] = []
    const api = createEnvatoClient({
      token: FAKE_TOKEN, delayMs: 0, sleep: async (ms) => { sleeps.push(ms) },
      fetchImpl: fakeFetch(() => (n++ === 0 ? { status: 429, headers: { 'retry-after': '7' } } : { status: 200, body: { total_hits: 3, matches: [] } })),
    })
    expect((await api.search({ category: 'a' })).total_hits).toBe(3)
    expect(sleeps).toContain(7000)
  })
  it('errors and logs never carry the token', async () => {
    const logs: string[] = []
    const spies = (['log', 'warn', 'error', 'info'] as const).map((k) => vi.spyOn(console, k).mockImplementation((...a) => { logs.push(a.join(' ')) }))
    const api = createEnvatoClient({ token: FAKE_TOKEN, delayMs: 0, fetchImpl: fakeFetch(() => ({ status: 401 })) })
    const err = await api.search({ category: 'a' }).catch((e: Error) => e)
    expect(String((err as Error).message)).toBe('Envato API HTTP 401 on search')
    const store = new MemoryCatalogStore()
    const res = await syncCatalog({ api, store, categories: ['a'], log: (l) => logs.push(l) })
    expect(res.error).not.toContain(FAKE_TOKEN)
    expect(JSON.stringify(store.runs)).not.toContain(FAKE_TOKEN)
    expect(logs.join('\n')).not.toContain(FAKE_TOKEN)
    spies.forEach((s) => s.mockRestore())
  })
  it('refuses to run without a server token', () => {
    const prev = process.env.ENVATO_API_TOKEN
    delete process.env.ENVATO_API_TOKEN
    expect(() => createEnvatoClient()).toThrow(/ENVATO_API_TOKEN is not set/)
    if (prev !== undefined) process.env.ENVATO_API_TOKEN = prev
  })
  it('reads Regular and Extended prices', () => {
    expect(parseItemPrices([{ licence: 'Regular License', price: '9.00' }, { licence: 'Extended License', price: '800.00' }])).toEqual({ regularCents: 900, extendedCents: 80000 })
    expect(formatCents(900)).toBe('$9')
    expect(formatCents(80000)).toBe('$800')
    expect(formatCents(null)).toBe('—')
  })
})

describe('token stays server-only', () => {
  it('.env.example has an EMPTY placeholder', () => {
    const ex = readFileSync(path.join(APP, '.env.example'), 'utf8')
    expect(ex).toMatch(/^ENVATO_API_TOKEN=$/m)
    expect(ex).not.toMatch(/NEXT_PUBLIC_ENVATO/)
  })
  it('client.ts imports server-only and no src file uses NEXT_PUBLIC_ENVATO', () => {
    expect(readFileSync(path.join(__dirname, 'client.ts'), 'utf8')).toMatch(/^import 'server-only'/m)
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
    for (const f of walk(path.join(APP, 'src')).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'))) {
      const s = readFileSync(f, 'utf8')
      expect(s, f).not.toMatch(/NEXT_PUBLIC_ENVATO/)
      if (/['"]use client['"]/.test(s)) expect(s, f).not.toMatch(/ENVATO_API_TOKEN|lib\/envato\/(client|sync|store-server)/)
    }
  })
  it('client bundles (.next/static) contain neither the token name nor its value', () => {
    const dir = path.join(APP, '.next/static')
    if (!existsSync(dir)) return // checked after `next build` (npm run verify builds first, test:bundle reruns)
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
    const val = process.env.ENVATO_API_TOKEN?.trim()
    for (const f of walk(dir)) {
      const s = readFileSync(f, 'utf8')
      expect(s.includes('ENVATO_API_TOKEN'), f).toBe(false)
      if (val) expect(s.includes(val), f).toBe(false)
    }
  })
})

function item(id: number, name: string, tags: string[] = [], extra: Partial<EnvatoSearchItem> = {}): EnvatoSearchItem {
  return { id, name, tags, price_cents: 1900, number_of_sales: 10, rating: { rating: 4.5, count: 2 }, classification: 'site-templates/corporate/business', ...extra }
}
function fakeApi(byCat: Record<string, EnvatoSearchItem[]>): EnvatoApi & { prices: number[] } {
  let calls = 0
  const prices: number[] = []
  return {
    prices,
    get calls() { return calls },
    async search(q) {
      calls++
      const all = byCat[q.category] ?? []
      const size = q.pageSize ?? 100
      const page = q.page ?? 1
      return { total_hits: all.length, matches: all.slice((page - 1) * size, page * size) }
    },
    async itemPrices(id) { calls++; prices.push(id); return { regularCents: 900, extendedCents: 80000 } },
  }
}

describe('sync', () => {
  it('upserts, flags hotel housekeeping for Lina, marks removed only after a complete sweep', async () => {
    const store = new MemoryCatalogStore()
    const cat = 'site-templates/corporate/business'
    const api = fakeApi({ [cat]: [item(1, 'Maid Service Pro'), item(2, 'Grand Hotel', ['housekeeping', 'hotel']), item(3, 'Clean Agency')] })
    const r1 = await syncCatalog({ api, store, categories: [cat], withExtendedPrices: false })
    expect(r1.complete).toBe(true)
    expect(r1.perCategory[cat]).toBe(3)
    expect(store.items.get(1)!.auto_niches).toContain('cleaning')
    expect(store.items.get(2)!.needs_lina).toBe(true)
    expect(store.items.get(3)!.auto_niches).not.toContain('cleaning')
    // second sweep without item 3: removed
    const api2 = fakeApi({ [cat]: [item(1, 'Maid Service Pro'), item(2, 'Grand Hotel', ['housekeeping', 'hotel'])] })
    const r2 = await syncCatalog({ api: api2, store, categories: [cat], withExtendedPrices: false })
    expect(r2.items_changed).toBe(0)
    expect(r2.items_removed).toBe(1)
    expect(store.items.get(3)!.status).toBe('removed')
    // an incomplete (budget-capped) sweep removes nothing
    const api3 = fakeApi({ [cat]: [] })
    const r3 = await syncCatalog({ api: api3, store, categories: [cat], maxCalls: 0 })
    expect(r3.complete).toBe(false)
    expect(r3.items_removed).toBe(0)
  })
  it('a template Lina decided on does not come back under Needs Lina after another sync', async () => {
    const store = new MemoryCatalogStore()
    const cat = 'c'
    const rows = [item(2, 'Grand Hotel', ['housekeeping', 'hotel']), item(4, 'Hostel Stay', ['housekeeping', 'hostel'])]
    await syncCatalog({ api: fakeApi({ c: rows }), store, categories: [cat], withExtendedPrices: false })
    expect(store.items.get(2)!.needs_lina).toBe(true)
    store.decide({ envato_item_id: 2, niche: 'cleaning', decision: 'no' })
    store.decide({ envato_item_id: 4, niche: 'cleaning', decision: 'yes' })
    // fresh data from the API (e.g. a sales bump) forces a rewrite of both rows
    const bumped = rows.map((r) => ({ ...r, number_of_sales: 99 }))
    await syncCatalog({ api: fakeApi({ c: bumped }), store, categories: [cat], withExtendedPrices: false })
    expect(store.items.get(2)!.needs_lina).toBe(false)
    expect(store.items.get(2)!.auto_niches).not.toContain('cleaning')
    expect(store.items.get(4)!.needs_lina).toBe(false)
    expect(store.items.get(4)!.auto_niches).toContain('cleaning')
  })
  it('fetches Regular + Extended prices for shortlisted items', async () => {
    const store = new MemoryCatalogStore()
    await store.upsertShortlist([{ envato_item_id: 1, niche: 'cleaning', name: 'x', url: 'u', demo_url: null, platform: 'HTML', verify_status: 'confirmed', verify_reason: null, build_note: null, note: null, source_file: 'f', raw: {}, active: true }])
    const api = fakeApi({ c: [item(1, 'Maid Service Pro')] })
    await syncCatalog({ api, store, categories: ['c'] })
    expect(api.prices).toEqual([1])
    expect(store.items.get(1)!.extended_price_cents).toBe(80000)
  })
})

describe('scheduled 3-hour job is OFF', () => {
  it('returns disabled unless ENVATO_CRON_ENABLED=true; trigger commented out in wrangler.jsonc', async () => {
    expect(ENVATO_CRON).toBe('0 */3 * * *')
    expect(envatoCronEnabled({})).toBe(false)
    expect(await runScheduledEnvatoSync({})).toBe('disabled')
    const w = readFileSync(path.join(APP, 'wrangler.jsonc'), 'utf8')
    const live = w.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(live).not.toMatch(/"triggers"|"crons"/)
    expect(w).toMatch(/\/\/ "triggers": \{ "crons": \["0 \*\/3 \* \* \*"\] \}/)
  })
})

const LINA_JSON = '/workspace/lina/envato-shortlist-2026-10-12.json'
describe('Lina shortlist import', () => {
  it('parses item ids from ThemeForest URLs', () => {
    expect(itemIdFromUrl('https://themeforest.net/item/foogra-restaurant-site-template/33945871')).toBe(33945871)
    expect(itemIdFromUrl('https://themeforest.net/item/x/19719166?s=1')).toBe(19719166)
  })
  it.runIf(existsSync(LINA_JSON))('imports 167 picks (125 confirmed, 23 cut, 19 unverified) keeping verify_status + build note', async () => {
    const json = JSON.parse(readFileSync(LINA_JSON, 'utf8'))
    const { rows, skipped } = shortlistRowsFromJson(json, LINA_JSON)
    expect(skipped).toEqual([])
    expect(rows).toHaveLength(167)
    const c = { confirmed: 0, cut: 0, unverified: 0 }
    rows.forEach((r) => c[r.verify_status]++)
    expect(c).toEqual({ confirmed: 125, cut: 23, unverified: 19 })
    expect(rows.some((r) => r.build_note)).toBe(true)
  })
  it('re-import is idempotent and never touches Lina’s decisions', async () => {
    const store = new MemoryCatalogStore()
    const json = { types: { cleaning: [
      { name: 'Be Clean', url: 'https://themeforest.net/item/be-clean/11111111', verify_status: 'confirmed', build_note: 'add tel: link + booking CTA' },
      { name: 'Maidy', url: 'https://themeforest.net/item/maidy/22222222', verify_status: 'unverified' },
    ] } }
    store.decide({ envato_item_id: 11111111, niche: 'cleaning', decision: 'yes' })
    store.decide({ envato_item_id: 33333333, niche: 'cleaning', decision: 'no' })
    const a = await importShortlist(store, json, 'v1')
    const b = await importShortlist(store, json, 'v1')
    expect(a.imported).toBe(2)
    expect(b.imported).toBe(2)
    expect(store.shortlist.size).toBe(2)
    expect(store.shortlist.get('11111111|cleaning')!.build_note).toBe('add tel: link + booking CTA')
    expect(store.decisionRows).toHaveLength(2)
    // final version drops Maidy: it goes inactive (not deleted), decisions still intact
    const c = await importShortlist(store, { types: { cleaning: [json.types.cleaning[0]] } }, 'v2')
    expect(c.deactivated).toBe(1)
    expect(store.shortlist.get('22222222|cleaning')!.active).toBe(false)
    expect(store.decisionRows).toHaveLength(2)
  })
})

describe('localhost-only gate (widen log, digest, templates)', () => {
  const dev = { NODE_ENV: 'development' }
  it('allows plain localhost', () => {
    expect(isLocalhostRequest(hdrs({ host: 'localhost:3000' }), dev)).toBe(true)
    expect(isLocalhostRequest(hdrs({ host: '127.0.0.1:3000', 'x-forwarded-for': '127.0.0.1' }), dev)).toBe(true)
    expect(isLocalhostRequest(hdrs({ host: 'localhost:3000', 'x-forwarded-for': '::ffff:127.0.0.1' }), dev)).toBe(true)
  })
  it('blocks remote Host and faked Host with a remote X-Forwarded-For / Forwarded / CF header', () => {
    expect(isLocalhostRequest(hdrs({ host: 'freeplug-in.dev' }), dev)).toBe(false)
    expect(isLocalhostRequest(hdrs({ host: 'localhost:3000', 'x-forwarded-for': '203.0.113.9' }), dev)).toBe(false)
    expect(isLocalhostRequest(hdrs({ host: 'localhost:3000', 'x-forwarded-for': '127.0.0.1, 203.0.113.9' }), dev)).toBe(false)
    expect(isLocalhostRequest(hdrs({ host: 'localhost', forwarded: 'for=198.51.100.7' }), dev)).toBe(false)
    expect(isLocalhostRequest(hdrs({ host: 'localhost', 'cf-connecting-ip': '198.51.100.7' }), dev)).toBe(false)
    expect(isLocalhostRequest(hdrs({ host: 'localhost', 'x-real-ip': '10.0.0.5' }), dev)).toBe(false)
    expect(isLocalhostRequest(hdrs({ host: 'localhost', 'x-forwarded-host': 'evil.example' }), dev)).toBe(false)
  })
  it('always blocks in production, even for localhost', () => {
    expect(isLocalhostRequest(hdrs({ host: 'localhost:3000' }), { NODE_ENV: 'production' })).toBe(false)
  })
})

describe('admin templates view', () => {
  it('requires a niche (no all view) and parses filters', () => {
    expect(parseFilters({}).niche).toBeNull()
    expect(parseFilters({ niche: 'all' }).niche).toBeNull()
    const f = parseFilters({ niche: 'cleaning', view: 'catalog', platform: 'wp', maxPrice: '20', minRating: '4' })
    expect(f).toMatchObject({ niche: 'cleaning', view: 'catalog', platform: 'wp', maxPrice: 20, minRating: 4 })
    expect(parseFilters({ msg: 'imported-167-125-23-19' }).msg).toBe('Imported 167 picks: 125 confirmed, 23 cut, 19 unverified.')
  })
  // Phase 2 (Aria): within one view show each template only once, even when it is both a
  // business-type match and a general fallback.
  it.todo('phase 2: dedupes a type match + general fallback so each template shows once per view')
})

describe('migration 20261012170000_envato_catalog', () => {
  const sql = readFileSync(path.join(APP, 'supabase/migrations/20261012170000_envato_catalog.sql'), 'utf8')
  const tables = ['envato_sync_runs', 'envato_items', 'template_shortlist', 'template_niche_decisions', 'template_widen_log']
  it('locks every table down like plan_steps (enable+force RLS, revoke all, service_role-only grants)', () => {
    for (const t of tables) {
      expect(sql).toContain(`alter table public.${t} enable row level security;`)
      expect(sql).toContain(`alter table public.${t} force row level security;`)
      expect(sql).toContain(`revoke all on table public.${t} from public, anon, authenticated, service_role;`)
    }
    expect(sql).not.toMatch(/grant [^;]* to (anon|authenticated|public)/i)
    expect(sql).not.toMatch(/create policy/i)
    expect(sql).not.toMatch(/grant [^;]*delete/i)
  })
})
