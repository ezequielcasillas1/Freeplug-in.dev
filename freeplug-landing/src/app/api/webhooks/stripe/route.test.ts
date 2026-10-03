// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Live webhooks can't be delivered (freeplug-in.dev doesn't resolve), so events are unit-tested.
const constructEvent = vi.fn()
const subsList = vi.fn()
const cancelNotice = vi.fn()

vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({ webhooks: { constructEvent }, subscriptions: { list: subsList } }),
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
  constructEvent.mockReturnValue({ id: 'evt_1', type, data: { object: obj } })
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
    constructEvent.mockReset()
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
    cancelNotice.mockRejectedValue(new Error('smtp down'))
    const r = await deliver('customer.subscription.updated', subscription({ cancel_at_period_end: true }))
    expect(r.status).toBe(200)
  })
})
