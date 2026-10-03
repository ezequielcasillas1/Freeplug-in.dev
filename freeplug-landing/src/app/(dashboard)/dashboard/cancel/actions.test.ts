// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase stand-in: a signed-in user whose profile has a Stripe customer id.
const chain = (result: unknown) => {
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
      chain(t === 'profiles' ? { data: { stripe_customer_id: 'cus_1', cumulative_website_value_paid_cents: 0 } } : { data: [], count: 0 }),
  }),
}))

const stripe = { mode: 'ok' as 'ok' | 'error' | 'tip' | 'starter11' | 'cancel-at-only' | 'grandfathered', tip: null as number | null }
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => {
    if (stripe.mode === 'error') return { subscriptions: { list: async () => { throw new Error('local mock: simulated Stripe outage') } } }
    if (stripe.mode === 'grandfathered') {
      // Vera's k: "Hosting plan (monthly)" $40 + "Pro add-on (monthly)" $10 (+ an optional tip item)
      const it = (name: string, unit_amount: number, quantity = 1, lookup_key: string | null = null) => ({ quantity, price: { id: `price_${unit_amount}`, lookup_key, product: { id: `prod_${unit_amount}`, name }, unit_amount, recurring: { interval: 'month' } }, current_period_end: 1793726938 })
      const items = [it('Hosting plan (monthly)', 4000), it('Pro add-on (monthly)', 1000), ...(stripe.tip == null ? [] : [it('Optional monthly tip', 100, stripe.tip, 'freeplug_tip_monthly')])]
      return { subscriptions: { list: async () => ({ data: [{ id: 'sub_k', status: 'active', cancel_at_period_end: false, canceled_at: null, schedule: null, items: { data: items } }] }) } }
    }
    if (stripe.mode === 'cancel-at-only') {
      // a cancel_at on its own (no period-end flag), before the period end
      const plan = { quantity: 1, price: { id: 'price_st', lookup_key: 'freeplug_step_starter_monthly', product: { name: 'Freeplug Hosting: Starter' }, unit_amount: 3500, recurring: { interval: 'month' } }, current_period_end: 1793726938 }
      return { subscriptions: { list: async () => ({ data: [{ id: 'sub_c', status: 'active', cancel_at_period_end: false, cancel_at: 1792500000, canceled_at: null, schedule: null, items: { data: [plan] } }] }) } }
    }
    if (stripe.mode === 'starter11') {
      // Vera 5b: Starter + $11, plan item first (the order the app now creates)
      const plan = { quantity: 1, price: { id: 'price_st', lookup_key: 'freeplug_step_starter_monthly', product: { name: 'Freeplug Hosting: Starter' }, unit_amount: 3500, recurring: { interval: 'month' } }, current_period_end: 1793726938 }
      const tip = { quantity: 11, price: { id: 'price_tip', lookup_key: 'freeplug_tip_monthly', product: { name: 'Optional monthly tip' }, unit_amount: 100, recurring: { interval: 'month' } }, current_period_end: 1793726938 }
      return { subscriptions: { list: async () => ({ data: [{ id: 'sub_s', status: 'active', cancel_at_period_end: false, canceled_at: null, schedule: null, items: { data: [plan, tip] } }] }) } }
    }
    if (stripe.mode === 'tip') {
      // Vera bug 4: Fast lane + $6, with the TIP item listed first (Stripe's item order isn't guaranteed).
      const tip = { quantity: 6, price: { id: 'price_tip', lookup_key: 'freeplug_tip_monthly', product: { name: 'Optional monthly tip' }, unit_amount: 100, recurring: { interval: 'month' } }, current_period_end: 1793726938 }
      const plan = { quantity: 1, price: { id: 'price_fl', lookup_key: 'freeplug_step_fast_lane_monthly', product: { name: 'Freeplug Hosting: Fast lane' }, unit_amount: 6500, recurring: { interval: 'month' } }, current_period_end: 1793726938 }
      return { subscriptions: { list: async () => ({ data: [{ id: 'sub_t', status: 'active', cancel_at_period_end: false, canceled_at: null, schedule: null, items: { data: [tip, plan] } }] }) } }
    }
    return {
      subscriptions: {
        list: async () => ({
          data: [
            {
              id: 'sub_1',
              status: 'active',
              cancel_at_period_end: false,
              canceled_at: null,
              items: { data: [{ price: { product: { name: 'Hosting plan (monthly)' }, unit_amount: 3500, recurring: { interval: 'month' } }, current_period_end: 1792000000 }] },
            },
          ],
        }),
      },
    }
  },
}))

import { getCancelPageData } from './actions'

describe('getCancelPageData and Stripe errors (round 12, Vera r9 bug 2)', () => {
  beforeEach(() => {
    stripe.mode = 'ok'
    stripe.tip = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads the real plan (subscriptionsLoaded true)', async () => {
    const d = await getCancelPageData({ tolerateStripeErrors: true })
    expect(d?.subscriptionsLoaded).toBe(true)
    expect(d?.subscriptions.map((s) => s.productName)).toEqual(['Hosting plan (monthly)'])
    expect(d?.subscriptions.map((s) => s.planName)).toEqual(['Hosting plan']) // grandfathered, no add-on (Sable 6:19 PM)
  })

  it('next round: a cancel_at on its own is "set to end" (Resume box, access until cancel_at), not a live plan to cancel', async () => {
    stripe.mode = 'cancel-at-only'
    const d = await getCancelPageData()
    expect(d?.subscriptions).toEqual([])
    expect(d?.canceledSubscriptions).toHaveLength(1)
    expect(d?.canceledSubscriptions[0]).toMatchObject({ id: 'sub_c', cancelAtPeriodEnd: true, currentPeriodEnd: new Date(1792500000 * 1000) })
  })

  it.each([
    [null, 0],
    [4, 400],
    [0, 0],
  ])('Vera copy-c4f9940 / Sable 6:19 PM: grandfathered card is "Hosting + Pro add-on" at the full $50 (tip %s kept separate)', async (tip, tipCents) => {
    stripe.mode = 'grandfathered'
    stripe.tip = tip
    const d = await getCancelPageData()
    expect(d?.subscriptions).toHaveLength(1)
    expect(d?.subscriptions[0]).toMatchObject({ planName: 'Hosting + Pro add-on', amount: 5000, tipCents, interval: 'month' })
  })

  it('outreach (tolerate): a Stripe outage returns empty lists and subscriptionsLoaded false, no throw', async () => {
    stripe.mode = 'error'
    const d = await getCancelPageData({ tolerateStripeErrors: true })
    expect(d).toMatchObject({ hasStripeCustomer: true, subscriptions: [], canceledSubscriptions: [], subscriptionsLoaded: false })
  })

  it('Vera bug 4: a tipped plan shows the plan item (not the tip item) and the tip separately', async () => {
    stripe.mode = 'tip'
    const d = await getCancelPageData()
    expect(d?.subscriptions).toHaveLength(1)
    expect(d?.subscriptions[0]).toMatchObject({ productName: 'Freeplug Hosting: Fast lane', amount: 6500, tipCents: 600, interval: 'month' })
    expect(d?.subscriptions[0].planName).toBe('Fast lane') // Sable 5:23 PM: the plan card heading
  })

  it('Vera 5b: Starter + $11 shows the plan ($35) and the $11 tip (was "Starter $35.00 / month")', async () => {
    stripe.mode = 'starter11'
    const d = await getCancelPageData()
    expect(d?.subscriptions[0]).toMatchObject({ productName: 'Freeplug Hosting: Starter', amount: 3500, tipCents: 1100 })
  })

  it('regular (default): the Stripe error still propagates (unchanged)', async () => {
    stripe.mode = 'error'
    await expect(getCancelPageData()).rejects.toThrow('simulated Stripe outage')
  })
})
