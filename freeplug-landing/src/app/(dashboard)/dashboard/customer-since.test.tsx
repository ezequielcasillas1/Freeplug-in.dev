// "Customer Since" across renewals and prorations. Adapted from Vera Noll's after-fix test
// (freeplug-qa/review3000-restore/scripts/customer-since.after-fix.vera.test.tsx, Oct 4 2026): it calls
// the real getEnhancedDashboardData and renders the real QuickStats; Supabase and Stripe are mocked,
// no network. Vera's addition: ledger fixtures (Oct 3 first payment + Nov 3 renewal) for the primary
// source, and a separate zero-ledger case for the subscription start_date fallback.
// Fixed clock: Nov 3, 2026 (the renewal date) and the days around it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

type LedgerRow = { id: string; created_at: string; amount_cents: number }
const fx = {
  ledger: [] as LedgerRow[],
  ledgerError: null as { code: string; message: string } | null,
  subs: [] as Record<string, unknown>[],
  stripeDown: false,
  invoiceCalls: 0,
}

// Supabase stand-in that honours select / order / limit on billing_ledger, so the dashboard's own
// queries (count, Recent activity newest first, first payment oldest first) each see real ordering.
const ledgerQuery = () => {
  const q = { columns: '', head: false, ascending: true, limit: Infinity }
  const c: Record<string, unknown> = {}
  c.select = (columns: string, opts?: { head?: boolean }) => ((q.columns = columns), (q.head = !!opts?.head), c)
  c.eq = () => c
  c.in = () => c
  c.order = (_col: string, o?: { ascending?: boolean }) => ((q.ascending = o?.ascending !== false), c)
  c.limit = (n: number) => ((q.limit = n), c)
  const result = () => {
    if (q.head) return { data: null, count: fx.ledger.length, error: null }
    if (q.columns === 'created_at' && fx.ledgerError) return { data: null, error: fx.ledgerError }
    const rows = [...fx.ledger].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    if (!q.ascending) rows.reverse()
    return { data: rows.slice(0, q.limit), error: null }
  }
  c.then = (ok: (v: unknown) => unknown) => Promise.resolve(result()).then(ok)
  return c
}
const plain = (result: unknown) => {
  const c: Record<string, unknown> = {}
  for (const k of ['select', 'eq', 'order', 'limit', 'in']) c[k] = () => c
  c.single = async () => result
  c.maybeSingle = async () => result
  c.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok)
  return c
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (t: string) =>
      t === 'profiles'
        ? plain({ data: { stripe_customer_id: 'cus_1', evaluation_status: 'none', cumulative_website_value_paid_cents: 0 } })
        : t === 'billing_ledger'
          ? ledgerQuery()
          : plain({ data: [], count: 0, error: null }),
  }),
}))

// Times from the restored review account: first payment Oct 3 2026 14:03:30 CT (19:03:30Z), monthly.
const T = (iso: string) => Math.floor(Date.parse(iso) / 1000)
const FIRST = '2026-10-03T19:03:30Z'
const sub = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1', status: 'active', created: T(FIRST), start_date: T(FIRST), cancel_at_period_end: false,
  items: { data: [{ price: { lookup_key: 'freeplug_step_fast_lane_monthly', product: { id: 'prod_fl', name: 'Freeplug Hosting: Fast lane' }, unit_amount: 6500, recurring: { interval: 'month' } }, quantity: 1, current_period_start: T('2026-11-03T19:03:30Z'), current_period_end: T('2026-12-03T19:03:30Z') }] },
  ...over,
})
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    subscriptions: {
      list: async () => {
        if (fx.stripeDown) throw new Error('Stripe is down')
        return { data: fx.subs }
      },
    },
    // The fix drops this call: it returned the NEWEST paid invoice (Stripe lists newest first).
    invoices: { list: async () => ((fx.invoiceCalls += 1), { data: [] }) },
  }),
}))

import { getEnhancedDashboardData } from './dashboard-actions'
import { QuickStats } from './QuickStats'

const shown = async () => {
  const d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
  const { unmount } = render(<QuickStats stats={d!.stats} />)
  const text = screen.getByTestId('customer-since').textContent
  unmount()
  return { days: d!.stats.daysSinceFirstPayment, text }
}
const row = (id: string, created_at: string, amount_cents = 6500): LedgerRow => ({ id, created_at, amount_cents })

beforeEach(() => {
  fx.ledger = []
  fx.ledgerError = null
  fx.subs = [sub()]
  fx.stripeDown = false
  fx.invoiceCalls = 0
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Customer Since from the ledger: first payment Oct 3, renewals do not reset it (Vera, Oct 4)', () => {
  it('Nov 2, before the renewal: 30d', async () => {
    fx.ledger = [row('l1', FIRST)]
    vi.setSystemTime(new Date('2026-11-02T20:00:00Z'))
    expect(await shown()).toEqual({ days: 30, text: '30d' })
  })

  it('Nov 3, renewal day (Oct 3 + Nov 3 rows): 31d, not "Today"', async () => {
    fx.ledger = [row('l1', FIRST), row('l2', '2026-11-03T19:03:30Z')]
    vi.setSystemTime(new Date('2026-11-03T20:00:00Z'))
    expect(await shown()).toEqual({ days: 31, text: '31d' })
  })

  it('Nov 4 (Oct 3 + Nov 3 rows): 32d, not 1d', async () => {
    fx.ledger = [row('l1', FIRST), row('l2', '2026-11-03T19:03:30Z')]
    vi.setSystemTime(new Date('2026-11-04T20:00:00Z'))
    expect(await shown()).toEqual({ days: 32, text: '32d' })
  })

  it('Dec 4, after two renewals (Oct 3 + Nov 3 + Dec 3 rows): 62d, not 1d', async () => {
    fx.ledger = [row('l1', FIRST), row('l2', '2026-11-03T19:03:30Z'), row('l3', '2026-12-03T19:03:30Z')]
    vi.setSystemTime(new Date('2026-12-04T20:00:00Z'))
    expect(await shown()).toEqual({ days: 62, text: '62d' })
  })

  it('a mid-cycle proration (upgrade, $9.99) does not reset it either', async () => {
    fx.ledger = [row('l1', FIRST), row('l2', '2026-10-03T19:15:07Z', 999), row('l3', '2026-11-03T19:03:30Z'), row('l4', '2026-11-03T22:00:00Z', 999)]
    vi.setSystemTime(new Date('2026-11-04T20:00:00Z'))
    expect(await shown()).toEqual({ days: 32, text: '32d' })
  })

  it('the ledger wins over an earlier subscription start (meaning stays "first payment")', async () => {
    fx.ledger = [row('l1', FIRST)]
    fx.subs = [sub({ created: T('2026-09-20T12:00:00Z'), start_date: T('2026-09-20T12:00:00Z') })]
    vi.setSystemTime(new Date('2026-11-03T20:00:00Z'))
    expect((await shown()).days).toBe(31)
  })

  it('first payment day: "Today"', async () => {
    fx.ledger = [row('l1', FIRST)]
    vi.setSystemTime(new Date('2026-10-03T23:00:00Z'))
    expect(await shown()).toEqual({ days: 0, text: 'Today' })
  })

  it('makes no invoices.list call', async () => {
    fx.ledger = [row('l1', FIRST), row('l2', '2026-11-03T19:03:30Z')]
    vi.setSystemTime(new Date('2026-11-04T20:00:00Z'))
    await shown()
    expect(fx.invoiceCalls).toBe(0)
  })

  it('still shows the ledger date when Stripe is down (outreach customers tolerate Stripe errors)', async () => {
    fx.ledger = [row('l1', FIRST)]
    fx.stripeDown = true
    vi.setSystemTime(new Date('2026-11-04T20:00:00Z'))
    expect((await shown()).days).toBe(32)
  })
})

describe('Customer Since fallback: zero ledger rows -> earliest subscription start_date', () => {
  it('Nov 3 renewal day, sub started Oct 3: 31d (no ledger rows, no invoice call)', async () => {
    vi.setSystemTime(new Date('2026-11-03T20:00:00Z'))
    expect(await shown()).toEqual({ days: 31, text: '31d' })
    expect(fx.invoiceCalls).toBe(0)
  })

  it('uses start_date over created, and the earliest across subscriptions', async () => {
    fx.subs = [
      sub({ id: 'sub_new', created: T('2026-10-20T00:00:00Z'), start_date: T('2026-10-20T00:00:00Z') }),
      sub({ id: 'sub_old', status: 'canceled', created: T('2026-09-01T00:00:00Z'), start_date: T(FIRST) }),
    ]
    vi.setSystemTime(new Date('2026-11-04T20:00:00Z'))
    expect((await shown()).days).toBe(32)
  })

  it('falls back to created when start_date is missing', async () => {
    fx.subs = [sub({ start_date: undefined })]
    vi.setSystemTime(new Date('2026-12-04T20:00:00Z'))
    expect((await shown()).days).toBe(62)
  })

  it('a failed first-payment ledger read falls back like no rows', async () => {
    fx.ledger = [row('l1', '2026-09-01T00:00:00Z')]
    fx.ledgerError = { code: '57014', message: 'canceling statement due to statement timeout' }
    vi.setSystemTime(new Date('2026-11-03T20:00:00Z'))
    expect((await shown()).days).toBe(31)
  })

  it('no ledger rows and Stripe down: "—"', async () => {
    fx.stripeDown = true
    vi.setSystemTime(new Date('2026-11-03T20:00:00Z'))
    expect(await shown()).toEqual({ days: null, text: '—' })
  })
})
