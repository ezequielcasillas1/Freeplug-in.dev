import { describe, expect, it, vi } from 'vitest'
import { PLAN_STEPS } from './ladder'
import { flagUnsoldPurchase, unsoldPurchaseFromSession } from './unsold-purchase'

const s = (over: Record<string, unknown> = {}) =>
  ({ id: 'cs_test_1', mode: 'subscription', status: 'complete', customer: { id: 'cus_1' }, subscription: 'sub_1', metadata: { plan_step: 'leads', supabase_user_id: 'not-a-uuid' }, ...over }) as never

describe('unsoldPurchaseFromSession', () => {
  it('a completed subscription session for a non-sellable step; bad user ids dropped; expanded ids read', () => {
    expect(unsoldPurchaseFromSession(s())).toEqual({ checkout_session_id: 'cs_test_1', user_id: null, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', plan_step: 'leads' })
  })
  it('nothing for sellable steps, open sessions, other modes or no step', () => {
    expect(unsoldPurchaseFromSession(s({ metadata: { plan_step: 'starter' } }))).toBeNull()
    expect(unsoldPurchaseFromSession(s({ status: 'open' }))).toBeNull()
    expect(unsoldPurchaseFromSession(s({ mode: 'setup' }))).toBeNull()
    expect(unsoldPurchaseFromSession(s({ metadata: {} }))).toBeNull()
  })
  it('follows the flag: a step turned off after purchase start is flagged', () => {
    const off = PLAN_STEPS.map((p) => (p.id === 'fast_lane' ? { ...p, sellable: false } : p))
    expect(unsoldPurchaseFromSession(s({ metadata: { plan_step: 'fast_lane' } }), off)?.plan_step).toBe('fast_lane')
  })
  it('flagUnsoldPurchase writes only when flagged', async () => {
    const record = vi.fn(async () => undefined)
    await flagUnsoldPurchase({ record }, s({ metadata: { plan_step: 'priority' } }))
    expect(record).not.toHaveBeenCalled()
    await flagUnsoldPurchase({ record }, s())
    expect(record).toHaveBeenCalledTimes(1)
  })
})
