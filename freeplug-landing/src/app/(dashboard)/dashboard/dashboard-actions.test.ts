// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase stand-in: a signed-in user whose profile has a Stripe customer id.
// db.ledger is what the billing_ledger rows query returns; db.selects records every select().
const db = {
  ledger: { data: [] as unknown[] | null, error: null as { code: string; message: string } | null },
  selects: [] as { table: string; columns: string }[],
}
const chain = (table: string, result: unknown) => {
  const c: Record<string, unknown> = {}
  for (const k of ['eq', 'order', 'limit', 'in']) c[k] = () => c
  c.select = (columns: string) => {
    db.selects.push({ table, columns })
    return c
  }
  c.single = async () => result
  c.maybeSingle = async () => result
  c.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok)
  return c
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    let ledgerCalls = 0
    return {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      from: (t: string) => {
        if (t === 'profiles') return chain(t, { data: { stripe_customer_id: 'cus_1', evaluation_status: 'none' } })
        // First billing_ledger call is the invoice count, the second is the Recent activity rows.
        if (t === 'billing_ledger' && ++ledgerCalls === 2) return chain(t, db.ledger)
        return chain(t, { data: [], count: 0 })
      },
    }
  },
}))

const stripe = { mode: 'ok' as 'ok' | 'error' }
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => {
    if (stripe.mode === 'error') return { subscriptions: { list: async () => { throw new Error('Stripe is down') } } }
    return {
      subscriptions: {
        list: async () => ({
          data: [
            {
              id: 'sub_1',
              status: 'active',
              created: 1790000000,
              cancel_at_period_end: false,
              items: { data: [{ price: { product: { name: 'Hosting plan (monthly)' }, unit_amount: 3500, recurring: { interval: 'month' } }, quantity: 1, current_period_end: 1792000000, current_period_start: 1790000000 }] },
            },
          ],
        }),
      },
      invoices: { list: async () => ({ data: [] }) },
    }
  },
}))

import { getEnhancedDashboardData } from './dashboard-actions'

describe('getEnhancedDashboardData and Stripe errors (round 9)', () => {
  beforeEach(() => {
    stripe.mode = 'ok'
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads the real plan', async () => {
    const d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
    expect(d?.subscriptionsLoaded).toBe(true)
    expect(d?.subscriptions.map((s) => s.productName)).toEqual(['Hosting plan (monthly)'])
  })

  it('outreach (tolerate): a Stripe error leaves no plans and subscriptionsLoaded = false instead of failing', async () => {
    stripe.mode = 'error'
    const d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
    expect(d?.subscriptionsLoaded).toBe(false)
    expect(d?.subscriptions).toEqual([])
    expect(d?.stats.activeSubscriptionCount).toBe(0)
  })

  it('non-outreach: a Stripe error still propagates (unchanged)', async () => {
    stripe.mode = 'error'
    await expect(getEnhancedDashboardData()).rejects.toThrow('Stripe is down')
  })
})

describe('Recent activity payments from billing_ledger (description column fix)', () => {
  beforeEach(() => {
    stripe.mode = 'ok'
    db.ledger = { data: [], error: null }
    db.selects = []
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows a payment row with a label built from amount_cents and created_at', async () => {
    db.ledger = {
      data: [{ id: 'led_1', created_at: '2026-10-03T15:00:00.000Z', amount_cents: 3500 }],
      error: null,
    }
    const d = await getEnhancedDashboardData()
    expect(d?.recentActivityLoaded).toBe(true)
    const payment = d?.recentActivity.find((a) => a.type === 'payment')
    expect(payment).toMatchObject({
      id: 'payment-led_1',
      title: 'Payment received',
      description: 'Payment of $35.00 on Oct 3, 2026',
      amount: 3500,
    })
    expect(payment?.date.toISOString()).toBe('2026-10-03T15:00:00.000Z')
  })

  it('never selects billing_ledger.description', async () => {
    await getEnhancedDashboardData()
    const ledgerSelects = db.selects.filter((s) => s.table === 'billing_ledger').map((s) => s.columns)
    expect(ledgerSelects).toContain('id, created_at, amount_cents')
    for (const cols of ledgerSelects) expect(cols).not.toMatch(/description/)
  })

  it('a failed billing_ledger query is logged and reported (recentActivityLoaded = false), not swallowed', async () => {
    db.ledger = { data: null, error: { code: '42703', message: 'column billing_ledger.description does not exist' } }
    const d = await getEnhancedDashboardData()
    expect(d?.recentActivityLoaded).toBe(false)
    expect(d?.recentActivity).toEqual([])
    expect(console.error).toHaveBeenCalledWith('[dashboard] recent activity: billing_ledger query failed', {
      code: '42703',
      message: 'column billing_ledger.description does not exist',
    })
    // No user id in the log line.
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('u1')
    // The rest of the dashboard still loads.
    expect(d?.subscriptionsLoaded).toBe(true)
  })
})
