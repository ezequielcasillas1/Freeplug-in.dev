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

const stripe = { mode: 'ok' as 'ok' | 'error' | 'ladder' | 'grandfathered-ending' | 'cancel-at-only' | 'trial-ending' }
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => {
    if (stripe.mode === 'error') return { subscriptions: { list: async () => { throw new Error('Stripe is down') } } }
    if (stripe.mode === 'ladder') {
      // Fast lane + $4 tip, set to end in 31 days (Stripe's shape: both cancel fields set)
      const end = Math.floor(Date.now() / 1000) + 31 * 86400 - 600
      const item = (lookup_key: string, name: string, unit_amount: number, quantity: number) => ({
        price: { lookup_key, product: { id: `prod_${lookup_key}`, name }, unit_amount, recurring: { interval: 'month' } },
        quantity,
        current_period_end: end,
        current_period_start: end - 30 * 86400,
      })
      return {
        subscriptions: {
          list: async () => ({
            data: [{ id: 'sub_l', status: 'active', created: 1790000000, cancel_at_period_end: true, cancel_at: end, items: { data: [item('freeplug_step_fast_lane_monthly', 'Freeplug Hosting: Fast lane', 6500, 1), item('freeplug_tip_monthly', 'Optional monthly tip', 100, 4)] } }],
          }),
        },
        invoices: { list: async () => ({ data: [] }) },
      }
    }
    if (stripe.mode === 'cancel-at-only' || stripe.mode === 'trial-ending') {
      // Starter; a cancel_at on its own 9 days out (period end 25 days out), or a trial set to end at period end in 5 days
      const now = Math.floor(Date.now() / 1000)
      const periodEnd = now + (stripe.mode === 'cancel-at-only' ? 25 : 5) * 86400 - 600
      const sub =
        stripe.mode === 'cancel-at-only'
          ? { status: 'active', cancel_at_period_end: false, cancel_at: now + 9 * 86400 - 600 }
          : { status: 'trialing', cancel_at_period_end: true, cancel_at: periodEnd }
      const item = { price: { lookup_key: 'freeplug_step_starter_monthly', product: { id: 'prod_st', name: 'Freeplug Hosting: Starter' }, unit_amount: 3500, recurring: { interval: 'month' } }, quantity: 1, current_period_end: periodEnd, current_period_start: periodEnd - 30 * 86400 }
      return {
        subscriptions: { list: async () => ({ data: [{ id: 'sub_c', created: 1790000000, ...sub, items: { data: [item] } }] }) },
        invoices: { list: async () => ({ data: [] }) },
      }
    }
    if (stripe.mode === 'grandfathered-ending') {
      // Hosting plan (monthly) + Pro add-on (monthly), set to end in 12 days
      const end = Math.floor(Date.now() / 1000) + 12 * 86400 - 600
      const item = (name: string, unit_amount: number) => ({
        price: { lookup_key: null, product: { id: `prod_${unit_amount}`, name }, unit_amount, recurring: { interval: 'month' } },
        quantity: 1,
        current_period_end: end,
        current_period_start: end - 30 * 86400,
      })
      return {
        subscriptions: {
          list: async () => ({
            data: [{ id: 'sub_g', status: 'active', created: 1790000000, cancel_at_period_end: true, cancel_at: end, items: { data: [item('Hosting plan (monthly)', 4000), item('Pro add-on (monthly)', 1500)] } }],
          }),
        },
        invoices: { list: async () => ({ data: [] }) },
      }
    }
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
    // grandfathered: the list and Recent activity keep the product name (no tip item here)
    expect(d?.subscriptions.map((s) => s.listName)).toEqual(['Hosting plan (monthly)'])
    expect(d?.subscriptions[0].ladderStep).toBe(false)
    expect(d?.recentActivity.find((a) => a.type === 'subscription_created')?.description).toBe('Hosting plan (monthly)')
  })

  it('Sable 5:11 + 5:23 PM / Vera B3: "Your Fast lane plan will end…" linking to the Resume box; list and Recent activity read "Fast lane + $4 tip"', async () => {
    stripe.mode = 'ladder'
    const d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
    const sub = d!.subscriptions[0]
    expect(sub.planName).toBe('Fast lane')
    expect(sub.listName).toBe('Fast lane + $4 tip')
    expect(sub.productName).toBe('Freeplug Hosting: Fast lane + Optional monthly tip')
    expect(sub.ladderStep).toBe(true)
    const started = d!.recentActivity.find((a) => a.type === 'subscription_created')!
    expect(started.description).toBe('Fast lane + $4 tip') // Sable 5:23 PM: same pattern as the list
    const alert = d!.alerts.find((a) => a.id === 'subscription-ending')!
    expect(alert.message).toMatch(/^Your Fast lane plan will end in 3[01] days\. Resume to keep your website live\.$/)
    expect(alert.message).not.toMatch(/tip|Freeplug Hosting/)
    expect(alert.actionLabel).toBe('Resume plan')
    expect(alert.actionHref).toBe('/dashboard/cancel#resume-plan')
  })

  it('Sable 5:30 PM: a grandfathered plan ending reads "Your hosting plan and Pro add-on will end in 12 days."', async () => {
    stripe.mode = 'grandfathered-ending'
    const d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
    expect(d!.subscriptions[0].ladderStep).toBe(false)
    expect(d!.subscriptions[0].planName).toBe('Hosting plan (monthly) + Pro add-on (monthly)') // the list keeps the product names
    const alert = d!.alerts.find((a) => a.id === 'subscription-ending')!
    expect(alert.message).toBe('Your hosting plan and Pro add-on will end in 12 days. Resume to keep your website live.')
    expect(alert.actionHref).toBe('/dashboard/cancel#resume-plan')
  })

  it('next round: the kept Subscription ending alert covers a cancel_at on its own (days to cancel_at, no billing reminder) and a trial', async () => {
    stripe.mode = 'cancel-at-only'
    let d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
    expect(d!.subscriptions[0].cancelAtPeriodEnd).toBe(true) // set to end
    expect(d!.alerts.find((a) => a.id === 'subscription-ending')).toMatchObject({
      message: 'Your Starter plan will end in 9 days. Resume to keep your website live.',
      actionHref: '/dashboard/cancel#resume-plan',
    })
    expect(d!.alerts.find((a) => a.id === 'upcoming-billing')).toBeUndefined()
    stripe.mode = 'trial-ending'
    d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
    expect(d!.alerts.find((a) => a.id === 'subscription-ending')?.message).toBe('Your Starter plan will end in 5 days. Resume to keep your website live.')
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
