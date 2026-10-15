// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

// Never send real email: the sender is mocked.
const sendCancelled = vi.fn()
vi.mock('@/lib/email/send', () => ({
  sendSubscriptionCancelledEmail: (...args: unknown[]) => sendCancelled(...args),
}))
// The email_sends ledger (round 6), in memory with the same rules as the SQL.
const ledger = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('../../../test/fake-email-sends').createFakeEmailSends> }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: (fn: string, a: Record<string, unknown>) => ledger.current!.rpc(fn, a) }) }))

import { createFakeEmailSends } from '../../../test/fake-email-sends'
import { CANCEL_EMAIL_EVENT_KEY, CANCEL_EMAIL_MARKER_KEY, sendCancelNoticeOnce } from './cancel-notice'

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
    ledger.current = createFakeEmailSends()
  })

  it('sends once when the plan is set to cancel, with the fixed date format', async () => {
    const { stripe } = makeStripe(canceledSub)
    expect(await sendCancelNoticeOnce(stripe, canceledSub as unknown as Stripe.Subscription, 'evt_1')).toBe('sent')
    expect(sendCancelled).toHaveBeenCalledTimes(1)
    expect(sendCancelled).toHaveBeenCalledWith('owner@example.com', { endDate: 'Oct 25, 2026' }, expect.any(Object))
  })

  it('is idempotent: repeat webhook deliveries do not send again', async () => {
    const { stripe, state } = makeStripe(canceledSub)
    const event = canceledSub as unknown as Stripe.Subscription
    await sendCancelNoticeOnce(stripe, event, 'evt_1')
    // a redelivery of the same event (ledger row 'sent'), and the "updated" event our metadata write causes
    expect(await sendCancelNoticeOnce(stripe, event, 'evt_1')).toBe('already_sent')
    expect(await sendCancelNoticeOnce(stripe, event, 'evt_2_metadata_update')).toBe('already_sent')
    expect(sendCancelled).toHaveBeenCalledTimes(1)
    expect((state.metadata as Record<string, string>)[CANCEL_EMAIL_MARKER_KEY]).toBe('1790000000')
    expect((state.metadata as Record<string, string>)[CANCEL_EMAIL_EVENT_KEY]).toBe('evt_1')
    expect(ledger.current!.byEvent('evt_2_metadata_update')).toBeUndefined() // skipped before any claim
  })

  it('does nothing when the plan is not set to cancel (or was resumed before the retry)', async () => {
    const active = { ...canceledSub, cancel_at_period_end: false, canceled_at: null }
    const { stripe } = makeStripe(active)
    expect(await sendCancelNoticeOnce(stripe, active as unknown as Stripe.Subscription, 'evt_1')).toBe('not_set_to_cancel')
    // Event says canceled, but Stripe now says resumed:
    const resumed = makeStripe(active)
    expect(await sendCancelNoticeOnce(resumed.stripe, canceledSub as unknown as Stripe.Subscription, 'evt_2')).toBe(
      'not_set_to_cancel'
    )
    expect(sendCancelled).not.toHaveBeenCalled()
  })

  it('a new cancellation after a resume gets a new email', async () => {
    const { stripe, state } = makeStripe(canceledSub)
    await sendCancelNoticeOnce(stripe, canceledSub as unknown as Stripe.Subscription, 'evt_1')
    state.canceled_at = 1791000000
    expect(await sendCancelNoticeOnce(stripe, { ...canceledSub, canceled_at: 1791000000 } as unknown as Stripe.Subscription, 'evt_9')).toBe('sent')
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
    expect(ledger.current!.byEvent('evt_124')).toMatchObject({ status: 'failed', last_error: 'local_error' })
    quiet.mockRestore()
  })

  it('a legacy marker (written before the ledger, no event key) still means already sent', async () => {
    const { stripe } = makeStripe({ ...canceledSub, metadata: { [CANCEL_EMAIL_MARKER_KEY]: '1790000000' } })
    expect(await sendCancelNoticeOnce(stripe, canceledSub as unknown as Stripe.Subscription, 'evt_new')).toBe('already_sent')
    expect(sendCancelled).not.toHaveBeenCalled()
    expect(ledger.current!.calls).toEqual([])
  })

  it('the ledger stores no recipient or Resend error text', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    sendCancelled.mockResolvedValueOnce({ success: false, reason: 'http', status: 422, error: 'Invalid `to` field: owner@example.com' })
    const { stripe } = makeStripe(canceledSub)
    await sendCancelNoticeOnce(stripe, canceledSub as unknown as Stripe.Subscription, 'evt_pii')
    const row = ledger.current!.byEvent('evt_pii')!
    expect(row).toMatchObject({ status: 'failed', last_error: 'http 422' })
    expect(JSON.stringify(row)).not.toContain('@')
    expect(JSON.stringify(quiet.mock.calls)).not.toContain('owner@example.com')
    quiet.mockRestore()
  })
})
