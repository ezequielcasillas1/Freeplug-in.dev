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
      chain(t === 'profiles' ? { data: { stripe_customer_id: 'cus_1', evaluation_status: 'none' } } : { data: [], count: 0 }),
  }),
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
