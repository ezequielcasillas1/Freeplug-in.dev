// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hosting ladder (Oct 3): the plan-step sync is unit-tested in plan-step-sync.test.ts.
const planStepSync = vi.hoisted(() => vi.fn(async () => ({ outcome: 'updated', stepId: 'starter' })))
vi.mock('@/lib/plans/plan-step-sync', () => ({
  syncPlanStepForCustomer: planStepSync,
  supabasePlanStepStore: () => ({}),
}))

// Live webhooks can't be delivered (freeplug-in.dev doesn't resolve), so events are unit-tested.
const constructEventAsync = vi.fn()
const subsList = vi.fn()
const cancelNotice = vi.fn()

vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({ webhooks: { constructEventAsync }, subscriptions: { list: subsList } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: vi.fn() }) }))
vi.mock('@/lib/email/cancel-notice', () => ({
  sendCancelNoticeOnce: (...args: unknown[]) => cancelNotice(...args),
}))

import { POST } from './route'

const FUTURE_END = Math.floor(Date.now() / 1000) + 20 * 86400

function subscription(over: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    items: { data: [{ current_period_end: FUTURE_END }] },
    ...over,
  }
}

async function deliver(type: string, obj: unknown) {
  constructEventAsync.mockResolvedValue({ id: 'evt_1', type, data: { object: obj } })
  const res = await POST(
    new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=x' },
      body: '{}',
    })
  )
  return { status: res.status, body: await res.json() }
}

describe('POST /api/webhooks/stripe: website access on subscription events (e)', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    constructEventAsync.mockReset()
    subsList.mockReset()
    cancelNotice.mockReset()
    cancelNotice.mockResolvedValue('not_set_to_cancel')
    subsList.mockResolvedValue({ data: [] })
  })

  it('created: active', async () => {
    const r = await deliver('customer.subscription.created', subscription())
    expect(r).toEqual({ status: 200, body: { received: true, websiteAccess: 'active' } })
  })

  it('updated to cancel at period end: ending, and the cancel email hook runs', async () => {
    const sub = subscription({ cancel_at_period_end: true })
    // Stripe's list may still hold the old copy; the event payload wins.
    subsList.mockResolvedValue({ data: [subscription()] })
    const r = await deliver('customer.subscription.updated', sub)
    expect(r.body.websiteAccess).toBe('ending')
    expect(cancelNotice).toHaveBeenCalledTimes(1)
    expect(cancelNotice.mock.calls[0][1]).toEqual(sub)
    expect(cancelNotice.mock.calls[0][2]).toBe('evt_1') // event.id → Resend idempotency key
  })

  it('updated back (resume): active', async () => {
    const r = await deliver('customer.subscription.updated', subscription({ cancel_at_period_end: false }))
    expect(r.body.websiteAccess).toBe('active')
  })

  it('updated to past_due (failed payment): still active', async () => {
    const r = await deliver('customer.subscription.updated', subscription({ status: 'past_due' }))
    expect(r.body.websiteAccess).toBe('active')
  })

  it('deleted: offline, and no cancel email', async () => {
    const r = await deliver('customer.subscription.deleted', subscription({ status: 'canceled' }))
    expect(r.body.websiteAccess).toBe('offline')
    expect(cancelNotice).not.toHaveBeenCalled()
  })

  it('deleted while another live plan exists: active', async () => {
    subsList.mockResolvedValue({ data: [subscription({ id: 'sub_2' })] })
    const r = await deliver('customer.subscription.deleted', subscription({ status: 'canceled' }))
    expect(r.body.websiteAccess).toBe('active')
  })

  it('a failing cancel email never fails the webhook', async () => {
    cancelNotice.mockRejectedValue(new Error('resend down'))
    const r = await deliver('customer.subscription.updated', subscription({ cancel_at_period_end: true }))
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ received: true, websiteAccess: 'ending' })
  })
})

describe('POST /api/webhooks/stripe: hosting ladder plan_step sync (Oct 3)', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    constructEventAsync.mockReset()
    subsList.mockReset()
    cancelNotice.mockReset()
    planStepSync.mockReset()
    cancelNotice.mockResolvedValue('not_set_to_cancel')
    subsList.mockResolvedValue({ data: [] })
    planStepSync.mockResolvedValue({ outcome: 'updated', stepId: 'leads' })
  })

  it.each(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'])(
    '%s: re-syncs profiles.plan_step for the customer, after the cancel notice',
    async (type) => {
      const r = await deliver(type, subscription())
      expect(r.status).toBe(200)
      expect(planStepSync).toHaveBeenCalledTimes(1)
      expect((planStepSync.mock.calls[0] as unknown[])[1]).toBe('cus_1')
    }
  )

  it('a failed sync answers 500 so Stripe retries (the cancel notice is idempotent per event)', async () => {
    planStepSync.mockRejectedValue(new Error('db down'))
    const r = await deliver('customer.subscription.updated', subscription({ cancel_at_period_end: true }))
    expect(r.status).toBe(500)
    expect(cancelNotice).toHaveBeenCalledTimes(1)
    expect(cancelNotice.mock.calls[0][2]).toBe('evt_1')
  })

  it('a replayed event syncs again to the same value (idempotent write)', async () => {
    await deliver('customer.subscription.updated', subscription())
    await deliver('customer.subscription.updated', subscription())
    expect(planStepSync).toHaveBeenCalledTimes(2)
    expect(planStepSync.mock.calls.map((c) => (c as unknown[])[1])).toEqual(['cus_1', 'cus_1'])
  })
})

describe('POST /api/webhooks/stripe: signature check (Cloudflare port, constructEventAsync)', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    constructEventAsync.mockReset()
  })

  it('awaits constructEventAsync with the raw body, the header and the secret', async () => {
    constructEventAsync.mockResolvedValue({ id: 'evt_x', type: 'ping.unhandled', data: { object: {} } })
    const res = await POST(
      new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=abc' }, body: '{"raw":true}' })
    )
    expect(res.status).toBe(200)
    expect(constructEventAsync).toHaveBeenCalledWith('{"raw":true}', 't=1,v1=abc', 'whsec_test')
  })

  it('a rejected (async) signature check is a 400, not a 500', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    constructEventAsync.mockRejectedValue(new Error('No signatures found matching the expected signature'))
    const res = await POST(
      new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=bad' }, body: '{}' })
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid signature' })
    quiet.mockRestore()
  })
})
