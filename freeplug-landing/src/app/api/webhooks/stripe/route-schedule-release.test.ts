// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Schedule lifecycle (Aria, Oct 3 3:43 PM): the webhook releases a plan-switch schedule as soon as its
 * switch phase is current (subscription_schedule.updated, and invoice.paid for the renewal at the
 * switch). A schedule with a phase still ahead is left alone; a release failure never fails the webhook.
 */
const h = vi.hoisted(() => ({ calls: [] as string[], schedule: null as Record<string, unknown> | null, releaseFails: false }))
const constructEventAsync = vi.fn()
const NOW_S = Math.floor(Date.now() / 1000)
const DAY = 86_400

vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync },
    subscriptions: { retrieve: async (id: string) => (h.calls.push(`subscriptions.retrieve:${id}`), { id, schedule: 'sub_sched_1' }) },
    subscriptionSchedules: {
      retrieve: async (id: string) => (h.calls.push(`schedules.retrieve:${id}`), h.schedule),
      release: async (id: string) => {
        h.calls.push(`schedules.release:${id}`)
        if (h.releaseFails) throw new Error('stripe down')
        return {}
      },
    },
  }),
}))
vi.mock('@/lib/outreach/server', () => ({ handleOutreachInvoicePaid: async () => false, handleOutreachSetupSession: async () => false }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const q = { select: () => q, eq: () => q, limit: async () => ({ data: [], error: null }) }
      return q
    },
  }),
}))

import { POST } from './route'

const switched = { id: 'sub_sched_1', status: 'active', phases: [{ start_date: NOW_S - 31 * DAY, end_date: NOW_S - 60 }, { start_date: NOW_S - 60, end_date: NOW_S + 30 * DAY }] }
const ahead = { id: 'sub_sched_1', status: 'active', phases: [{ start_date: NOW_S - DAY, end_date: NOW_S + 3 * DAY }, { start_date: NOW_S + 3 * DAY, end_date: NOW_S + 33 * DAY }] }

async function send(type: string, object: Record<string, unknown>) {
  constructEventAsync.mockResolvedValue({ id: 'evt_s', type, data: { object } })
  const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' }))
  return res.status
}

describe('webhook: release the schedule once its switch phase is current', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    h.calls.length = 0
    h.schedule = null
    h.releaseFails = false
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  it('subscription_schedule.updated at the switch: released', async () => {
    expect(await send('subscription_schedule.updated', switched)).toBe(200)
    expect(h.calls).toEqual(['schedules.release:sub_sched_1'])
  })

  it('subscription_schedule.updated with a switch still ahead (e.g. the downgrade was just planned): left alone', async () => {
    expect(await send('subscription_schedule.updated', ahead)).toBe(200)
    expect(h.calls).toEqual([])
  })

  it('an already released schedule: nothing to do', async () => {
    expect(await send('subscription_schedule.updated', { ...switched, status: 'released' })).toBe(200)
    expect(h.calls).toEqual([])
  })

  it('invoice.paid for the renewal at the switch (current API shape): the subscription schedule is released', async () => {
    h.schedule = switched
    const inv = { id: 'in_1', customer: 'cus_1', amount_paid: 5500, billing_reason: 'subscription_cycle', parent: { subscription_details: { subscription: 'sub_1' } }, lines: { data: [] } }
    expect(await send('invoice.paid', inv)).toBe(200)
    expect(h.calls).toEqual(['subscriptions.retrieve:sub_1', 'schedules.retrieve:sub_sched_1', 'schedules.release:sub_sched_1'])
  })

  it('invoice.paid that is not a renewal (an upgrade proration) never looks at schedules', async () => {
    h.schedule = switched
    await send('invoice.paid', { id: 'in_2', customer: 'cus_1', amount_paid: 1000, billing_reason: 'subscription_update', subscription: 'sub_1', lines: { data: [] } })
    expect(h.calls).toEqual([])
  })

  it('a release failure is logged, never a non-2xx (the next read releases it lazily)', async () => {
    h.releaseFails = true
    h.schedule = switched
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await send('subscription_schedule.updated', switched)).toBe(200)
    expect(err).toHaveBeenCalledWith('[webhook] schedule release failed', 'subscription_schedule.updated', 'stripe down')
    err.mockRestore()
  })
})
