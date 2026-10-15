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

const stripe = {
  mode: 'ok' as 'ok' | 'error' | 'ladder' | 'grandfathered-ending' | 'cancel-at-only' | 'trial-ending' | 'renewal',
  tip: null as number | null,
  /** renewal mode: the customer balance (positive = a carried small amount owed) and the upcoming invoice. */
  balance: 0,
  previews: [] as unknown[],
  previewFails: false,
  renewalDays: 5,
  /** cancel-at-only / trial-ending: override the subscription status (L-2: past_due, unpaid). */
  status: null as string | null,
}
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
      if (stripe.status) Object.assign(sub, { status: stripe.status })
      return {
        subscriptions: { list: async () => ({ data: [{ id: 'sub_c', created: 1790000000, ...sub, items: { data: [item] } }] }) },
        invoices: { list: async () => ({ data: [] }) },
      }
    }
    if (stripe.mode === 'renewal') {
      // Priority + Big change, renewing in 5 days (the Upcoming billing reminder shows)
      const periodEnd = Math.floor(Date.now() / 1000) + stripe.renewalDays * 86400 - 600
      const item = (lookup_key: string, name: string, unit_amount: number) => ({ price: { lookup_key, product: { id: `prod_${lookup_key}`, name }, unit_amount, recurring: { interval: 'month' } }, quantity: 1, current_period_end: periodEnd, current_period_start: periodEnd - 30 * 86400 })
      return {
        subscriptions: { list: async () => ({ data: [{ id: 'sub_r', status: 'active', created: 1790000000, cancel_at_period_end: false, items: { data: [item('freeplug_step_priority_monthly', 'Freeplug Hosting: Priority', 5500), item('freeplug_addon_big_change_monthly', 'Big change', 575)] } }] }) },
        invoices: {
          list: async () => ({ data: [] }),
          // Stripe's upcoming invoice: the customer balance applied (a debit is added); deliberately NOT price + carried
          createPreview: async (p: unknown) => {
            stripe.previews.push(p)
            if (stripe.previewFails) throw new Error('stripe 500 (simulated)')
            return { object: 'invoice', amount_due: 7135, starting_balance: stripe.balance, total: 7135 - stripe.balance, currency: 'usd' }
          },
        },
        customers: { retrieve: async () => ({ id: 'cus_1', object: 'customer', balance: stripe.balance }) },
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
            data: [{ id: 'sub_g', status: 'active', created: 1790000000, cancel_at_period_end: true, cancel_at: end, items: { data: [item('Hosting plan (monthly)', 4000), item('Pro add-on (monthly)', 1000), ...(stripe.tip == null ? [] : [{ ...item('Optional monthly tip', 100), quantity: stripe.tip, price: { ...item('Optional monthly tip', 100).price, lookup_key: 'freeplug_tip_monthly' } }])] } }],
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
import { formatPlanEndDate } from '@/lib/stripe/active-subscription'

describe('getEnhancedDashboardData and Stripe errors (round 9)', () => {
  beforeEach(() => {
    stripe.mode = 'ok'
    stripe.tip = null
    stripe.status = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads the real plan', async () => {
    const d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
    expect(d?.subscriptionsLoaded).toBe(true)
    expect(d?.subscriptions.map((s) => s.productName)).toEqual(['Hosting plan (monthly)'])
    // grandfathered, no add-on (Sable 6:19 PM): the list and Recent activity read "Hosting plan"
    expect(d?.subscriptions.map((s) => s.listName)).toEqual(['Hosting plan'])
    expect(d?.subscriptions[0].ladderStep).toBe(false)
    expect(d?.recentActivity.find((a) => a.type === 'subscription_created')?.description).toBe('Hosting plan')
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

  it.each([
    [null, 'Hosting + Pro add-on', 5000],
    [4, 'Hosting + Pro add-on + $4 tip', 5400],
    [0, 'Hosting + Pro add-on', 5000],
  ])('Sable 6:19 PM: grandfathered with add-on, tip %s: list and Recent activity "%s"; total and ending alert unchanged', async (tip, name, amount) => {
    stripe.mode = 'grandfathered-ending'
    stripe.tip = tip
    const d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
    expect(d!.subscriptions[0].listName).toBe(name)
    expect(d!.subscriptions[0].amount).toBe(amount)
    expect(d!.recentActivity.find((a) => a.type === 'subscription_created')?.description).toBe(name)
    expect(d!.alerts.find((a) => a.id === 'subscription-ending')?.message).toBe('Your hosting plan and Pro add-on will end in 12 days. Resume to keep your website live.')
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

  it.each(['past_due', 'unpaid'])('L-2 (phase 3): a %s subscription set to end gets the same Subscription ending alert', async (status) => {
    stripe.status = status
    stripe.mode = 'cancel-at-only'
    let d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
    expect(d!.alerts.find((a) => a.id === 'subscription-ending')).toMatchObject({
      title: 'Subscription ending',
      message: 'Your Starter plan will end in 9 days. Resume to keep your website live.',
      actionLabel: 'Resume plan',
      actionHref: '/dashboard/cancel#resume-plan',
    })
    stripe.mode = 'trial-ending' // the cancel_at_period_end path
    d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
    expect(d!.alerts.find((a) => a.id === 'subscription-ending')?.message).toBe('Your Starter plan will end in 5 days. Resume to keep your website live.')
  })

  it('L-2: canceled / incomplete subscriptions still get no Subscription ending alert', async () => {
    for (const status of ['canceled', 'incomplete', 'incomplete_expired']) {
      stripe.status = status
      stripe.mode = 'cancel-at-only'
      const d = await getEnhancedDashboardData({ tolerateStripeErrors: true })
      expect(d!.alerts.find((a) => a.id === 'subscription-ending')).toBeUndefined()
    }
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

describe('Upcoming billing reminder: the renewal line (Aria 3:13 PM), with a carried small amount (Aria 2:40 PM, Sable two lines)', () => {
  // The renewal date the mock sends (5 days out), in the Plans renewal line's format ("November 3, 2026").
  const renewsOn = () => formatPlanEndDate(new Date((Math.floor(Date.now() / 1000) + 5 * 86400 - 600) * 1000))
  beforeEach(() => {
    stripe.mode = 'renewal'
    stripe.previews = []
    stripe.previewFails = false
    stripe.renewalDays = 5
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  it('carried pending: the amount is Stripe\'s upcoming-invoice total, and the gray line says what is included', async () => {
    stripe.balance = 35
    const a = (await getEnhancedDashboardData())!.alerts.find((x) => x.id === 'upcoming-billing')!
    expect(a.message).toBe(`Your next bill will be $71.35 on ${renewsOn()}.`)
    expect(a.message).not.toMatch(/due in|days/)
    expect(a.detail).toBe('Includes $0.35 left from your last change.')
    expect(stripe.previews).toEqual([{ subscription: 'sub_r' }])
  })
  it('nothing carried: the line is unchanged (the plan price), no gray line, no preview call', async () => {
    stripe.balance = 0
    const a = (await getEnhancedDashboardData())!.alerts.find((x) => x.id === 'upcoming-billing')!
    expect(a.message).toBe(`Your next bill will be $60.75 on ${renewsOn()}.`)
    expect(a).not.toHaveProperty('detail')
    expect(stripe.previews).toEqual([])
  })
  it('account credit (balance below 0, nothing carried): unchanged too', async () => {
    stripe.balance = -200
    const a = (await getEnhancedDashboardData())!.alerts.find((x) => x.id === 'upcoming-billing')!
    expect(a.message).toBe(`Your next bill will be $60.75 on ${renewsOn()}.`)
    expect(a).not.toHaveProperty('detail')
  })
  it('carried pending but the upcoming preview fails: the plain renewal line (plan price), no gray line, logged', async () => {
    stripe.balance = 35
    stripe.previewFails = true
    const a = (await getEnhancedDashboardData())!.alerts.find((x) => x.id === 'upcoming-billing')!
    expect(a.message).toBe(`Your next bill will be $60.75 on ${renewsOn()}.`)
    expect(a).not.toHaveProperty('detail')
    expect(console.error).toHaveBeenCalledWith('[dashboard] upcoming invoice preview failed', 'stripe 500 (simulated)')
  })
  it('the 7-day window is unchanged: 7 days out shows it, 8 days out does not', async () => {
    stripe.balance = 0
    stripe.renewalDays = 7
    expect((await getEnhancedDashboardData())!.alerts.find((x) => x.id === 'upcoming-billing')).toBeDefined()
    stripe.renewalDays = 8
    expect((await getEnhancedDashboardData())!.alerts.find((x) => x.id === 'upcoming-billing')).toBeUndefined()
  })
})

