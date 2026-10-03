// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

// Never send real email: the sender is mocked.
const sendCancelled = vi.fn()
vi.mock('@/lib/email/send', () => ({
  sendSubscriptionCancelledEmail: (...args: unknown[]) => sendCancelled(...args),
}))

import { CANCEL_EMAIL_MARKER_KEY, sendCancelNoticeOnce } from './cancel-notice'

const PERIOD_END = 1792886400 // Oct 25, 2026

function makeStripe(initial: Record<string, unknown>) {
  // A tiny in-memory Stripe: metadata written by update() is seen by later retrieve() calls.
  const state = { ...initial, metadata: { ...(initial.metadata as object) } } as Record<string, unknown>
  const stripe = {
    subscriptions: {
      retrieve: vi.fn(async () => ({ ...state, metadata: { ...(state.metadata as object) } })),
      update: vi.fn(async (_id: string, params: { metadata?: Record<string, string> }) => {
        state.metadata = { ...(state.metadata as object), ...params.metadata }
        return state
      }),
    },
    customers: { retrieve: vi.fn(async () => ({ id: 'cus_1', email: 'owner@example.com' })) },
  }
  return { stripe: stripe as unknown as Stripe, raw: stripe, state }
}

const canceledSub = {
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: true,
  cancel_at: null,
  canceled_at: 1790000000,
  metadata: {},
  items: { data: [{ current_period_end: PERIOD_END }] },
}

describe('sendCancelNoticeOnce', () => {
  beforeEach(() => {
    sendCancelled.mockReset()
    sendCancelled.mockResolvedValue({ success: true, id: 'm1' })
  })

  it('sends once when the plan is set to cancel, with the fixed date format', async () => {
    const { stripe } = makeStripe(canceledSub)
    expect(await sendCancelNoticeOnce(stripe, canceledSub as unknown as Stripe.Subscription)).toBe('sent')
    expect(sendCancelled).toHaveBeenCalledTimes(1)
    expect(sendCancelled).toHaveBeenCalledWith('owner@example.com', { endDate: 'Oct 25, 2026' })
  })

  it('is idempotent: repeat webhook deliveries do not send again', async () => {
    const { stripe, state } = makeStripe(canceledSub)
    const event = canceledSub as unknown as Stripe.Subscription
    await sendCancelNoticeOnce(stripe, event)
    expect(await sendCancelNoticeOnce(stripe, event)).toBe('already_sent')
    expect(await sendCancelNoticeOnce(stripe, event)).toBe('already_sent')
    expect(sendCancelled).toHaveBeenCalledTimes(1)
    expect((state.metadata as Record<string, string>)[CANCEL_EMAIL_MARKER_KEY]).toBe('1790000000')
  })

  it('does nothing when the plan is not set to cancel (or was resumed before the retry)', async () => {
    const active = { ...canceledSub, cancel_at_period_end: false, canceled_at: null }
    const { stripe } = makeStripe(active)
    expect(await sendCancelNoticeOnce(stripe, active as unknown as Stripe.Subscription)).toBe('not_set_to_cancel')
    // Event says canceled, but Stripe now says resumed:
    const resumed = makeStripe(active)
    expect(await sendCancelNoticeOnce(resumed.stripe, canceledSub as unknown as Stripe.Subscription)).toBe(
      'not_set_to_cancel'
    )
    expect(sendCancelled).not.toHaveBeenCalled()
  })

  it('a new cancellation after a resume gets a new email', async () => {
    const { stripe, state } = makeStripe(canceledSub)
    await sendCancelNoticeOnce(stripe, canceledSub as unknown as Stripe.Subscription)
    state.canceled_at = 1791000000
    expect(await sendCancelNoticeOnce(stripe, { ...canceledSub, canceled_at: 1791000000 } as unknown as Stripe.Subscription)).toBe('sent')
    expect(sendCancelled).toHaveBeenCalledTimes(2)
  })

  it('passes the Resend idempotency key `<event.id>:subscription-cancelled` (Oct 3)', async () => {
    const { stripe } = makeStripe(canceledSub)
    expect(await sendCancelNoticeOnce(stripe, canceledSub as unknown as Stripe.Subscription, 'evt_123')).toBe('sent')
    expect(sendCancelled).toHaveBeenCalledWith('owner@example.com', expect.any(Object), { idempotencyKey: 'evt_123:subscription-cancelled' })
  })

  it('a throwing sender is send_failed (never an exception), after the claim was written', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    sendCancelled.mockRejectedValue(new Error('resend down'))
    const { stripe, raw } = makeStripe(canceledSub)
    expect(await sendCancelNoticeOnce(stripe, canceledSub as unknown as Stripe.Subscription, 'evt_124')).toBe('send_failed')
    expect(raw.subscriptions.update).toHaveBeenCalledTimes(1)
    quiet.mockRestore()
  })
})
