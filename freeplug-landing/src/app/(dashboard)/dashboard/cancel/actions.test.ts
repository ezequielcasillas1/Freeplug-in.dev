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

const stripe = { mode: 'ok' as 'ok' | 'error' }
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => {
    if (stripe.mode === 'error') return { subscriptions: { list: async () => { throw new Error('local mock: simulated Stripe outage') } } }
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
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('loads the real plan (subscriptionsLoaded true)', async () => {
    const d = await getCancelPageData({ tolerateStripeErrors: true })
    expect(d?.subscriptionsLoaded).toBe(true)
    expect(d?.subscriptions.map((s) => s.productName)).toEqual(['Hosting plan (monthly)'])
  })

  it('outreach (tolerate): a Stripe outage returns empty lists and subscriptionsLoaded false, no throw', async () => {
    stripe.mode = 'error'
    const d = await getCancelPageData({ tolerateStripeErrors: true })
    expect(d).toMatchObject({ hasStripeCustomer: true, subscriptions: [], canceledSubscriptions: [], subscriptionsLoaded: false })
  })

  it('regular (default): the Stripe error still propagates (unchanged)', async () => {
    stripe.mode = 'error'
    await expect(getCancelPageData()).rejects.toThrow('simulated Stripe outage')
  })
})
