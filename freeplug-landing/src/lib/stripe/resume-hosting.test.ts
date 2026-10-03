import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

const list = vi.fn()
const update = vi.fn()
vi.mock('@/lib/stripe/server', () => ({ getStripe: () => ({ subscriptions: { list, update } }) }))

import { resumeEndingSubscriptions } from './resume-hosting'

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
