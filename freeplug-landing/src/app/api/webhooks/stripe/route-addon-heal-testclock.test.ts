// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import type { AddonId } from '@/lib/plans/ladder'
import { createStripeSim, SIM_PRICE_ID, type SimEvent, type StripeSim } from '../../../../../test/stripe-addon-sim'

/**
 * TEST-CLOCK test (Aria, Oct 4 8:59 AM CT, ruling 2d), SIMULATED: the crash between paying for an add-on
 * and adding it, healed by the REAL webhook route (invoice.paid). Stripe is the in-memory stand-in with
 * a simulated clock (test/stripe-addon-sim.ts); the change-plan lock is the same claim/release RPC
 * shape on that clock; the ledger is the route's own code. No real Stripe test clock: every test-mode
 * event on the box reaches the :3000 listener (team rule, Vera and Jace 9:03), so Vera runs the real
 * one after Ezequiel's :3000 review.
 */
const h = vi.hoisted(() => ({
  sim: null as null | import('../../../../../test/stripe-addon-sim').StripeSim,
  event: null as unknown,
  ledger: [] as { stripe_invoice_id: string; amount_cents: number }[],
  total: 0,
}))
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({ ...h.sim!.client(), webhooks: { constructEventAsync: async () => h.event } }),
}))
vi.mock('@/lib/stripe/prices', async (orig) => ({ ...(await orig<typeof import('@/lib/stripe/prices')>()), getAddonPriceId: async (id: AddonId) => `price_addon_${id}` }))
vi.mock('@/lib/outreach/server', () => ({ handleOutreachInvoicePaid: async () => false, handleOutreachSetupSession: async () => false }))
// Real self-heal; only the lock WAIT is zero (a held lock answers non-2xx at once instead of after 8 s).
vi.mock('@/lib/stripe/addon-heal-webhook', async (orig) => {
  const actual = await orig<typeof import('@/lib/stripe/addon-heal-webhook')>()
  return {
    ...actual,
    healAddonChargeFromWebhook: (d: Parameters<typeof actual.healAddonChargeFromWebhook>[0], inv: Parameters<typeof actual.healAddonChargeFromWebhook>[1]) =>
      actual.healAddonChargeFromWebhook({ ...d, lockWaitMs: 0, now: h.sim!.now, log: () => {} }, inv),
  }
})
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    // plan_change_lock_claim / _release on the simulated clock
    rpc: async (fn: string, args: { p_user_id: string; p_ttl_seconds?: number; p_claim_id?: string }) => {
      if (fn === 'plan_change_lock_claim') return { data: await h.sim!.lockStore.claim(args.p_user_id, args.p_ttl_seconds ?? 60), error: null }
      if (fn === 'plan_change_lock_release') return { data: (await h.sim!.lockStore.release(args.p_user_id, args.p_claim_id!), true), error: null }
      throw new Error(`unexpected rpc ${fn}`)
    },
    from: (table: string) => {
      if (table === 'profiles') {
        const q = {
          select: () => q,
          eq: () => q,
          limit: async () => ({ data: [{ id: 'p1', cumulative_website_value_paid_cents: h.total }], error: null }),
          update: (v: { cumulative_website_value_paid_cents?: number }) => {
            if (typeof v.cumulative_website_value_paid_cents === 'number') h.total = v.cumulative_website_value_paid_cents
            return { eq: async () => ({ error: null }) }
          },
        }
        return q
      }
      if (table === 'billing_ledger') {
        return {
          insert: async (row: { stripe_invoice_id: string; amount_cents: number }) => {
            if (h.ledger.some((r) => r.stripe_invoice_id === row.stripe_invoice_id)) return { error: { code: '23505' } }
            h.ledger.push(row)
            return { error: null }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { POST } from './route'
import { changeAddon } from '@/lib/stripe/change-plan'

const USER = '11111111-2222-4333-8444-555555555555'
const T0 = Math.floor(new Date('2026-10-04T14:00:00Z').getTime() / 1000)
type SubArg = Parameters<typeof changeAddon>[1]

async function deliver(ev: SimEvent) {
  h.event = ev
  const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' }))
  return res.status
}
const addonItems = (sim: StripeSim, id: AddonId) => sim.sub('sub_1').items.data.filter((i) => i.price.id === SIM_PRICE_ID.addon(id))
const tipOf = (sim: StripeSim) => sim.sub('sub_1').items.data.find((i) => i.price.id === SIM_PRICE_ID.tip)?.quantity ?? 0

/** The Plans page request: holds the user's lock, charges, and dies right after the payment. */
async function crashAfterPay(sim: StripeSim, addon: AddonId, tipDropTo?: number) {
  await sim.lockStore.claim(USER, 60)
  await changeAddon(
    { stripe: sim.client({ crashAfter: 'invoices.pay' }) as unknown as Stripe, addonPriceIdFor: async (id) => SIM_PRICE_ID.addon(id), now: sim.now, log: () => {} },
    sim.sub('sub_1') as unknown as SubArg,
    addon,
    'on',
    { userId: USER, prorationDate: sim.nowSec(), tipDropTo }
  )
  return sim.events.find((e) => e.data.object.metadata.freeplug_kind === 'addon_first_period')!
}

describe('simulated test clock: crash between paying and adding, healed by invoice.paid', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'
    h.ledger.length = 0
    h.total = 0
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('Starter $19 tip: crash -> 500 while the lock is held -> added on redelivery (tip $14) -> renewal $54, one item, ledger once', async () => {
    const sim = (h.sim = createStripeSim({ nowSec: T0 }))
    sim.addCustomer('cus_1')
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'starter', tip: 19, periodStart: T0 - 10 * 86_400 })
    const paid = await crashAfterPay(sim, 'small_edit', 14)
    expect(paid.data.object).toMatchObject({ status: 'paid', amount_paid: 500 })
    expect(addonItems(sim, 'small_edit')).toHaveLength(0)

    // T0+2s: first delivery; the crashed request's lock is still held -> non-2xx, Stripe will redeliver
    sim.advance(2)
    expect(await deliver(paid)).toBe(500)
    expect(addonItems(sim, 'small_edit')).toHaveLength(0)
    expect(h.ledger).toEqual([expect.objectContaining({ stripe_invoice_id: paid.data.object.id, amount_cents: 500 })]) // booked once anyway

    // T0+63s: lock expired; Stripe's retry heals it
    sim.advance(61)
    expect(await deliver(paid)).toBe(200)
    expect(addonItems(sim, 'small_edit')).toHaveLength(1)
    expect(tipOf(sim)).toBe(14)

    // duplicate + concurrent deliveries: still one item, ledger unchanged
    expect(await Promise.all([deliver(paid), deliver(paid)])).toEqual([200, 200])
    expect(addonItems(sim, 'small_edit')).toHaveLength(1)
    expect(h.ledger).toHaveLength(1)
    expect(h.total).toBe(500)

    // the clock reaches the renewal: $35 + $5 + $14 = $54 billed and booked
    sim.advance(21 * 86_400)
    const renewal = sim.events.find((e) => e.data.object.billing_reason === 'subscription_cycle')!
    expect(renewal.data.object.total).toBe(5400)
    expect(await deliver(renewal)).toBe(200)
    expect(h.ledger.map((r) => r.amount_cents)).toEqual([500, 5400])
    // the first event replayed after the renewal: nothing changes
    expect(await deliver(paid)).toBe(200)
    expect(addonItems(sim, 'small_edit')).toHaveLength(1)
    expect(sim.creditNotes).toHaveLength(0)
  })

  it('crash, then the plan is canceled before the retry: refunded automatically once; Total Paid still counts it (ruling 2c)', async () => {
    const sim = (h.sim = createStripeSim({ nowSec: T0 }))
    sim.addCustomer('cus_1')
    sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', periodStart: T0 - 10 * 86_400 })
    const paid = await crashAfterPay(sim, 'big_change')
    sim.cancel('sub_1')
    sim.advance(61)
    expect(await deliver(paid)).toBe(200)
    expect(await deliver(paid)).toBe(200)
    expect(sim.creditNotes).toEqual([expect.objectContaining({ invoice: paid.data.object.id, amount: 575, refund_amount: 575 })])
    expect(sim.invoice(paid.data.object.id).metadata.addon_refunded).toBe('true')
    expect(h.total).toBe(575) // refunds stay counted for now (src/pending-later.txt)
  })
})
