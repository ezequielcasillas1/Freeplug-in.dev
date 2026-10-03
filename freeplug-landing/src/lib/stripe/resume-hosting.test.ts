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

  it('clears the scheduled cancellation on live plans only', async () => {
    list.mockResolvedValue({
      data: [
        { id: 'sub_end', status: 'active', cancel_at_period_end: true, cancel_at: null },
        { id: 'sub_at', status: 'active', cancel_at_period_end: false, cancel_at: 1792886400 },
        { id: 'sub_ok', status: 'active', cancel_at_period_end: false, cancel_at: null },
        { id: 'sub_gone', status: 'canceled', cancel_at_period_end: true, cancel_at: null },
      ],
    })
    const stripe = { subscriptions: { list, update } } as unknown as Stripe
    expect(await resumeEndingSubscriptions(stripe, 'cus_1')).toBe(2)
    expect(update).toHaveBeenCalledWith('sub_end', { cancel_at_period_end: false })
    expect(update).toHaveBeenCalledWith('sub_at', { cancel_at_period_end: false, cancel_at: '' })
    expect(update).toHaveBeenCalledTimes(2)
  })
})
