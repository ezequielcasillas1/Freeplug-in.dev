// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Aria, Oct 3 12:56: a Checkout Session for a step that is no longer sold can still complete (opened
 * before the flag turned off and not expired yet). The webhook HONORS it (no cancel, no refund, no
 * Stripe write) and flags it in plan_unsold_purchases for the admin badge; one row per session.
 */
vi.mock('@/lib/plans/plan-step-sync', () => ({ syncPlanStepForCustomer: vi.fn(), supabasePlanStepStore: () => ({}) }))
const constructEventAsync = vi.fn()
const stripeWrites = vi.fn()
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync },
    subscriptions: { cancel: stripeWrites, update: stripeWrites, list: vi.fn(async () => ({ data: [] })) },
    refunds: { create: stripeWrites },
  }),
}))
const upserts: { table: string; row: Record<string, unknown>; opts: unknown }[] = []
let upsertError: { message: string } | null = null
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      update: () => ({ eq: async () => ({ error: null }) }),
      upsert: async (row: Record<string, unknown>, opts: unknown) => {
        if (table === 'stripe_webhook_events') return { error: null } // phase 4 L-1 processed marker
        upserts.push({ table, row, opts })
        return { error: upsertError }
      },
    }),
  }),
}))
vi.mock('@/lib/email/cancel-notice', () => ({ sendCancelNoticeOnce: vi.fn() }))

import { POST } from './route'

const UID = '11111111-2222-4333-8444-555555555555'
const session = (step: string, over: Record<string, unknown> = {}) => ({
  id: 'cs_test_abc123',
  object: 'checkout.session',
  mode: 'subscription',
  status: 'complete',
  customer: 'cus_1',
  subscription: 'sub_1',
  metadata: { type: 'hosting', plan_step: step, supabase_user_id: UID },
  ...over,
})
async function deliver(obj: unknown) {
  constructEventAsync.mockResolvedValue({ id: 'evt_1', type: 'checkout.session.completed', data: { object: obj } })
  const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' }))
  return res.status
}

describe('checkout.session.completed for a step that is no longer sellable', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    upserts.length = 0
    upsertError = null
    stripeWrites.mockReset()
  })

  it.each(['leads', 'get_found', 'growth'])('%s: honored (no Stripe write) and flagged once per session', async (step) => {
    expect(await deliver(session(step))).toBe(200)
    expect(stripeWrites).not.toHaveBeenCalled()
    expect(upserts).toEqual([
      {
        table: 'plan_unsold_purchases',
        row: { checkout_session_id: 'cs_test_abc123', user_id: UID, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', plan_step: step },
        opts: { onConflict: 'checkout_session_id', ignoreDuplicates: true },
      },
    ])
  })

  it('a sellable step is not flagged', async () => {
    expect(await deliver(session('fast_lane'))).toBe(200)
    expect(upserts).toEqual([])
  })

  it('a session that is not a ladder subscription is not flagged (maintenance payment)', async () => {
    expect(await deliver(session('leads', { mode: 'payment', metadata: { type: 'maintenance' } }))).toBe(200)
    expect(upserts).toEqual([])
  })

  it('a failed flag write answers 500 so Stripe redelivers (still no cancel)', async () => {
    upsertError = { message: 'db down' }
    expect(await deliver(session('growth'))).toBe(500)
    expect(stripeWrites).not.toHaveBeenCalled()
  })
})
