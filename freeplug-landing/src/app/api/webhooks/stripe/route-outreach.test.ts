// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Outreach billing branches of the Stripe webhook (setup-mode Checkout, first invoice paid).
const state = { event: null as unknown, setupCalls: [] as unknown[], invoiceCalls: [] as unknown[], setupFails: false, profileUpdates: 0 }

vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({ webhooks: { constructEventAsync: async () => state.event }, subscriptions: { list: async () => ({ data: [] }) } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => {
      const chain = {
        update: () => ((state.profileUpdates += 1), chain),
        select: () => chain,
        eq: () => chain,
        limit: async () => ({ data: [], error: null }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(ok),
      }
      return chain
    },
  }),
}))
vi.mock('@/lib/email/cancel-notice', () => ({ sendCancelNoticeOnce: async () => 'not_set_to_cancel' }))
vi.mock('@/lib/outreach/server', () => ({
  handleOutreachSetupSession: async (s: unknown) => {
    state.setupCalls.push(s)
    if (state.setupFails) throw new Error('db down')
    return { handled: true, outcome: 'card_saved' }
  },
  handleOutreachInvoicePaid: async (inv: unknown) => (state.invoiceCalls.push(inv), true),
}))

import { POST } from './route'

async function deliver(type: string, obj: unknown) {
  state.event = { id: 'evt_1', type, data: { object: obj } }
  const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' }))
  return res.status
}

describe('Stripe webhook: outreach billing', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    Object.assign(state, { setupCalls: [], invoiceCalls: [], setupFails: false, profileUpdates: 0 })
  })

  it('setup-mode checkout only saves the card through the outreach handler', async () => {
    expect(await deliver('checkout.session.completed', { id: 'cs_1', mode: 'setup', customer: 'cus_1', metadata: {} })).toBe(200)
    expect(state.setupCalls).toHaveLength(1)
    expect(state.profileUpdates).toBe(0)
  })

  it('a failed setup save answers 500 so Stripe retries', async () => {
    state.setupFails = true
    expect(await deliver('checkout.session.completed', { id: 'cs_1', mode: 'setup' })).toBe(500)
  })

  it('subscription-mode checkout keeps the existing path', async () => {
    expect(await deliver('checkout.session.completed', { id: 'cs_2', mode: 'subscription', customer: 'cus_1', metadata: { supabase_user_id: 'u1' } })).toBe(200)
    expect(state.setupCalls).toHaveLength(0)
    expect(state.profileUpdates).toBe(1)
  })

  it('invoice.paid lets the outreach handler mark the site live', async () => {
    expect(await deliver('invoice.paid', { id: 'in_1', customer: 'cus_1', amount_paid: 0 })).toBe(200)
    expect(state.invoiceCalls).toHaveLength(1)
  })
})
