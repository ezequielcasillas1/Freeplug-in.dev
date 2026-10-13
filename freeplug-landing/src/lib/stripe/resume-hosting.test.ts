import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

const list = vi.fn()
const update = vi.fn()
vi.mock('@/lib/stripe/server', () => ({ getStripe: () => ({ subscriptions: { list, update } }) }))

import { resumeEndingSubscriptions, resumeOutcomeFromLive } from './resume-hosting'

describe('resumeEndingSubscriptions', () => {
  beforeEach(() => {
    list.mockReset()
    update.mockReset()
  })

  it("Stripe's real shape after a cancel at period end (BOTH fields set): only cancel_at_period_end:false is sent (Vera 5b R1)", async () => {
    list.mockResolvedValue({
      data: [
        // what Stripe returns after cancel_at_period_end=true: cancel_at is the period end too
        { id: 'sub_end', status: 'active', cancel_at_period_end: true, cancel_at: 1793726938 },
        // a cancel_at set on its own (no period-end flag)
        { id: 'sub_at', status: 'active', cancel_at_period_end: false, cancel_at: 1792886400 },
        { id: 'sub_ok', status: 'active', cancel_at_period_end: false, cancel_at: null },
        { id: 'sub_gone', status: 'canceled', cancel_at_period_end: true, cancel_at: 1793726938 },
      ],
    })
    const stripe = { subscriptions: { list, update } } as unknown as Stripe
    expect(await resumeEndingSubscriptions(stripe, 'cus_1')).toBe(2)
    expect(update).toHaveBeenCalledWith('sub_end', { cancel_at_period_end: false })
    expect(update).toHaveBeenCalledWith('sub_at', { cancel_at: '' })
    expect(update).toHaveBeenCalledTimes(2)
    // never both parameters in one request (Stripe refuses that)
    for (const [, params] of update.mock.calls) expect(Object.keys(params as object)).toHaveLength(1)
  })

  it('a Stripe error is thrown to the caller (which shows the support error, never the portal)', async () => {
    list.mockResolvedValue({ data: [{ id: 'sub_end', status: 'active', cancel_at_period_end: true, cancel_at: 1793726938 }] })
    update.mockRejectedValue(new Error('Received both cancel_at_period_end and cancel_at parameters.'))
    const stripe = { subscriptions: { list, update } } as unknown as Stripe
    await expect(resumeEndingSubscriptions(stripe, 'cus_1')).rejects.toThrow('Received both')
  })
})

describe('resumeOutcomeFromLive (Vera B1/B2: re-read Stripe before showing a failure)', () => {
  const sub = (status: string, over: Record<string, unknown> = {}) =>
    ({ status, cancel_at_period_end: false, cancel_at: null, ...over }) as unknown as Stripe.Subscription
  const ending = sub('active', { cancel_at_period_end: true, cancel_at: 1793742023 })
  it('active (or trialing) and not ending: resumed, whether or not the lock was held', () => {
    expect(resumeOutcomeFromLive([sub('active')], false)).toBe('resumed')
    expect(resumeOutcomeFromLive([sub('active')], true)).toBe('resumed')
    expect(resumeOutcomeFromLive([sub('trialing')], true)).toBe('resumed')
  })
  it('still ending: busy only when the lock was held, otherwise failed', () => {
    expect(resumeOutcomeFromLive([ending], true)).toBe('busy')
    expect(resumeOutcomeFromLive([ending], false)).toBe('failed')
    expect(resumeOutcomeFromLive([sub('active', { cancel_at: 1793742023 })], true)).toBe('busy') // cancel_at alone
    expect(resumeOutcomeFromLive([sub('active'), ending], false)).toBe('failed') // one of two still ending
  })
  it('no running plan (none, or only past_due): failed', () => {
    expect(resumeOutcomeFromLive([], true)).toBe('failed')
    expect(resumeOutcomeFromLive([sub('past_due')], false)).toBe('failed')
  })
})
