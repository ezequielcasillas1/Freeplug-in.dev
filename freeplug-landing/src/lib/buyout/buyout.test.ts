import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_BUYOUT_PRICE,
  ADMIN_BUYOUT_QUOTED,
  ADMIN_BUYOUT_REQUESTED,
  BUYOUT_CANCEL_BODY,
  BUYOUT_CANCEL_HEADING,
  BUYOUT_DASHBOARD_BODY,
  BUYOUT_DASHBOARD_HEADING,
  BUYOUT_FAQ_ANSWER,
  BUYOUT_FAQ_QUESTION,
  BUYOUT_REQUEST_LABEL,
  BUYOUT_THANKS,
  BUYOUT_NOTE_MARKER,
  formatBuyoutPrice,
  parseBuyoutPriceInput,
  recordBuyoutRequest,
  showBuyoutCard,
  type BuyoutStore,
  type OpenRequestRow,
  type RequestDetails,
} from './buyout'
import { computeWebsiteAccess } from '@/lib/website-access'

type Row = RequestDetails & {
  id: string
  user_id: string
  notes: string | null
  status: string
  updated_at: string
  is_buyout?: boolean
}

/**
 * In-memory website_requests with the real guarantees: one open request per user (like the
 * website_requests_one_open_per_user index) and conditional updates on updated_at. Every call
 * yields to the event loop first, so two parallel requests interleave like two tabs.
 */
function memoryStore(rows: Row[] = []) {
  let clock = 0
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const open = (userId: string) =>
    rows.find((r) => r.user_id === userId && (r.status === 'submitted' || r.status === 'in_review'))
  const store: BuyoutStore = {
    async getOpenRequest(userId) {
      await tick()
      const r = open(userId)
      return r ? { id: r.id, notes: r.notes, updated_at: r.updated_at, is_buyout: r.is_buyout === true } : null
    },
    async getLatestDetails(userId) {
      await tick()
      const r = [...rows].reverse().find((x) => x.user_id === userId)
      return r ? { business_name: r.business_name, contact_phone: r.contact_phone, google_business_url: r.google_business_url } : null
    },
    async markBuyoutIfUnchanged(row: OpenRequestRow, notes: string) {
      await tick()
      const r = rows.find((x) => x.id === row.id)
      if (!r || r.updated_at !== row.updated_at || r.status === 'closed') return false
      r.is_buyout = true
      r.notes = notes
      r.updated_at = `t${++clock}`
      return true
    },
    async insertRequest(userId, details, notes) {
      await tick()
      if (open(userId)) return 'conflict'
      rows.push({ id: `r${rows.length + 1}`, user_id: userId, ...details, notes, status: 'submitted', updated_at: `t${++clock}`, is_buyout: true })
      return 'ok'
    },
  }
  return { store, rows }
}

const buyoutCount = (rows: Row[]) =>
  rows.reduce((n, r) => n + (r.notes?.split(BUYOUT_NOTE_MARKER).length ?? 1) - 1, 0)
const openBuyouts = (rows: Row[]) => rows.filter((r) => r.is_buyout && r.status !== 'closed').length

const closedRequest: Row = {
  id: 'old', user_id: 'u1', business_name: 'Tacos Kyle', contact_phone: '512', google_business_url: null,
  notes: 'old notes', status: 'closed', updated_at: 't0',
}

describe('recordBuyoutRequest duplicate guard', () => {
  it('double click / two tabs with no open request: one request, one buyout block', async () => {
    const { store, rows } = memoryStore([{ ...closedRequest }])
    const results = await Promise.all([recordBuyoutRequest(store, 'u1'), recordBuyoutRequest(store, 'u1')])
    expect(results.every((r) => r.ok)).toBe(true)
    expect(results.filter((r) => r.ok && !r.alreadyRequested)).toHaveLength(1)
    expect(rows.filter((r) => r.status === 'submitted')).toHaveLength(1)
    expect(openBuyouts(rows)).toBe(1)
    expect(buyoutCount(rows)).toBe(1)
    // New request reuses the latest business details.
    expect(rows.find((r) => r.status === 'submitted')?.business_name).toBe('Tacos Kyle')
  })

  it('five parallel calls on an existing open request: marker added once, notes kept', async () => {
    const { store, rows } = memoryStore([
      { ...closedRequest, id: 'open', notes: 'Change request (Help chat):\nType: Photos', status: 'in_review', updated_at: 't0' },
    ])
    const results = await Promise.all(Array.from({ length: 5 }, () => recordBuyoutRequest(store, 'u1')))
    expect(results.every((r) => r.ok)).toBe(true)
    expect(results.filter((r) => r.ok && !r.alreadyRequested)).toHaveLength(1)
    expect(rows[0].is_buyout).toBe(true)
    expect(buyoutCount(rows)).toBe(1)
    expect(rows[0].notes).toMatch(/^Change request \(Help chat\):\nType: Photos\n\nBuyout request \(dashboard\):/)
  })

  it('a later click returns alreadyRequested and writes nothing', async () => {
    const { store, rows } = memoryStore([{ ...closedRequest }])
    await recordBuyoutRequest(store, 'u1')
    const before = JSON.stringify(rows)
    expect(await recordBuyoutRequest(store, 'u1')).toEqual({ ok: true, alreadyRequested: true })
    expect(JSON.stringify(rows)).toBe(before)
  })

  it('once the owner closes the buyout request, the customer can ask again', async () => {
    const { store, rows } = memoryStore([{ ...closedRequest }])
    await recordBuyoutRequest(store, 'u1')
    rows.find((r) => r.status === 'submitted')!.status = 'closed'
    expect(await recordBuyoutRequest(store, 'u1')).toEqual({ ok: true, alreadyRequested: false })
    expect(rows.filter((r) => r.status === 'submitted')).toHaveLength(1)
  })

  it('customer deleted the notes line: the request is still a buyout (is_buyout), nothing written', async () => {
    const { store, rows } = memoryStore([
      { ...closedRequest, id: 'open', notes: 'edited by customer', status: 'submitted', is_buyout: true },
    ])
    const before = JSON.stringify(rows)
    expect(await recordBuyoutRequest(store, 'u1')).toEqual({ ok: true, alreadyRequested: true })
    expect(JSON.stringify(rows)).toBe(before)
  })

  it('customer pasted the notes line into a normal request: not a buyout, so the server marks it', async () => {
    const { store, rows } = memoryStore([
      { ...closedRequest, id: 'open', notes: `${BUYOUT_NOTE_MARKER}\nRequested: pasted`, status: 'submitted', is_buyout: false },
    ])
    expect(await recordBuyoutRequest(store, 'u1')).toEqual({ ok: true, alreadyRequested: false })
    expect(rows[0].is_buyout).toBe(true)
  })

  it('refuses when the open request notes are full', async () => {
    const { store } = memoryStore([{ ...closedRequest, notes: 'x'.repeat(4990), status: 'submitted' }])
    const r = await recordBuyoutRequest(store, 'u1')
    expect(r.ok).toBe(false)
  })
})

describe('buyout helpers', () => {
  it('has no notes-based buyout detector (is_buyout is the only signal)', async () => {
    const mod = await import('./buyout')
    expect(mod).not.toHaveProperty('isBuyoutRequest')
  })

  it('never reads a price from notes: the buyout module has no notes-price parser', async () => {
    const mod = await import('./buyout')
    for (const name of ['buyoutPriceDollars', 'legacyBuyoutPriceDollars', 'withBuyoutPrice']) {
      expect(mod, name).not.toHaveProperty(name)
    }
    // No exported helper turns a "Buyout price: $1" notes line into a price.
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value !== 'function' || name === 'recordBuyoutRequest') continue
      let out: unknown
      try {
        out = (value as (x: unknown) => unknown)(`${BUYOUT_NOTE_MARKER}\nBuyout price: $1`)
      } catch {
        continue
      }
      expect(out, name).not.toBe(1)
      expect(out, name).not.toBe(100)
      expect(out, name).not.toEqual({ ok: true, cents: 100 })
    }
  })

  it('parses the admin price input as whole dollars and returns cents', () => {
    expect(parseBuyoutPriceInput('1200')).toEqual({ ok: true, cents: 120_000 })
    expect(parseBuyoutPriceInput(' $1,200 ')).toEqual({ ok: true, cents: 120_000 })
    expect(parseBuyoutPriceInput('1')).toEqual({ ok: true, cents: 100 })
    expect(parseBuyoutPriceInput('500000')).toEqual({ ok: true, cents: 50_000_000 })
    for (const bad of ['', '0', '-5', '12.50', '1e3', 'abc', '500001', '1,20', '99999999999999999999']) {
      expect(parseBuyoutPriceInput(bad)).toEqual({ ok: false, error: 'Use whole dollars from 1 to 500,000.' })
    }
  })

  it('formats cents for the admin label', () => {
    expect(formatBuyoutPrice(120_000)).toBe('$1,200')
    expect(formatBuyoutPrice(100)).toBe('$1')
    expect(formatBuyoutPrice(120_050)).toBe('$1,200.50')
  })

  const NOW = new Date('2026-09-25T20:00:00Z')
  const end = new Date('2026-10-25T00:00:00Z')
  it.each([
    ['active', [{ status: 'active', cancelAtPeriodEnd: false, cancelAt: null, currentPeriodEnd: end }]],
    ['ending', [{ status: 'active', cancelAtPeriodEnd: true, cancelAt: null, currentPeriodEnd: end }]],
    ['offline', [{ status: 'canceled', cancelAtPeriodEnd: false, cancelAt: null, currentPeriodEnd: null }]],
  ] as const)('shows the dashboard card for %s customers', (state, subs) => {
    const access = computeWebsiteAccess(subs, NOW)
    expect(access.status).toBe(state)
    expect(showBuyoutCard(access)).toBe(true)
  })

  it('hides the card when the customer never had hosting or Stripe could not be read', () => {
    expect(showBuyoutCard(computeWebsiteAccess([], NOW))).toBe(false)
    expect(showBuyoutCard(null)).toBe(false)
  })
})

const LOCKED_FILE =
  process.env.FREEPLUG_LOCKED_COPY ??
  '/workspace/freeplug-qa/freeplug-english-source-LOCKED-2026-09-24.txt'

// Drift guard: runs where Sable's locked file exists (the box). Latest entry for a label wins.
describe.skipIf(!existsSync(LOCKED_FILE))('buyout copy matches the locked file word for word', () => {
  const lines = existsSync(LOCKED_FILE) ? readFileSync(LOCKED_FILE, 'utf8').split('\n') : []
  const quoted = (label: string) => {
    const line = lines.findLast((l) => l.startsWith(`${label}  `))
    expect(line, label).toBeDefined()
    // Only quoted strings after the label (a label can contain quotes itself).
    return [...line!.slice(label.length).matchAll(/"([^"]*)"/g)].map((m) => m[1])
  }
  it.each([
    ['FAQ (new question)', BUYOUT_FAQ_QUESTION],
    ['FAQ (new answer)', BUYOUT_FAQ_ANSWER],
    ['dashboard section (replaces EvaluationProgress) heading', BUYOUT_DASHBOARD_HEADING],
    ['dashboard section body', BUYOUT_DASHBOARD_BODY],
    ['dashboard button', BUYOUT_REQUEST_LABEL],
    ['dashboard after request', BUYOUT_THANKS],
    ['cancel page card (replaces "Progress Toward Ownership") heading', BUYOUT_CANCEL_HEADING],
    ['cancel page card body', BUYOUT_CANCEL_BODY],
    ['cancel page card link', BUYOUT_REQUEST_LABEL],
  ])('%s', (label, value) => {
    expect(quoted(label)[0]).toBe(value)
  })
  it('admin labels', () => {
    expect(quoted('admin labels')).toEqual([ADMIN_BUYOUT_REQUESTED, ADMIN_BUYOUT_PRICE, ADMIN_BUYOUT_QUOTED])
  })
  it('no "website files" left in customer buyout copy', () => {
    for (const v of [BUYOUT_FAQ_ANSWER, BUYOUT_DASHBOARD_BODY, BUYOUT_THANKS, BUYOUT_CANCEL_BODY]) {
      expect(v).not.toMatch(/website files/i)
    }
  })
})
