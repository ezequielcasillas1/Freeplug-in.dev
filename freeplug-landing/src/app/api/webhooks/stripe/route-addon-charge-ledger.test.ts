// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Add-ons (Aria, Oct 4 8:28 AM): the full-price first-period charge is its own invoice; booked once in the ledger and Total Paid. */
const h = vi.hoisted(() => ({
  inserts: [] as Record<string, unknown>[],
  insertErrors: [] as (null | { code: string })[],
  profileUpdates: [] as Record<string, unknown>[],
}))
const constructEventAsync = vi.fn()

vi.mock('@/lib/stripe/server', () => ({ getStripe: () => ({ webhooks: { constructEventAsync } }) }))
vi.mock('@/lib/outreach/server', () => ({ handleOutreachInvoicePaid: async () => false, handleOutreachSetupSession: async () => false }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        const q = {
          select: () => q,
          eq: () => q,
          limit: async () => ({ data: [{ id: 'p1', cumulative_website_value_paid_cents: 1000 }], error: null }),
          update: (v: Record<string, unknown>) => {
            h.profileUpdates.push(v)
            return { eq: async () => ({ error: null }) }
          },
        }
        return q
      }
      if (table === 'billing_ledger') {
        return {
          insert: async (row: Record<string, unknown>) => {
            h.inserts.push(row)
            return { error: h.insertErrors.shift() ?? null }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { POST } from './route'

async function deliver(inv: Record<string, unknown>) {
  constructEventAsync.mockResolvedValue({ id: `evt_${String(inv.id)}`, type: 'invoice.paid', data: { object: inv } })
  const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' }))
  return res.status
}

/** The one-off invoice changeAddon creates: no subscription, one invoice item, billing_reason manual. */
const addonCharge = {
  id: 'in_addon',
  customer: 'cus_1',
  billing_reason: 'manual',
  status: 'paid',
  parent: null,
  amount_paid: 575,
  metadata: { freeplug_kind: 'addon_first_period', addon: 'big_change', subscription: 'sub_1' },
  lines: { data: [{ amount: 575, description: 'Add-on: big_change (this billing period)', pricing: null }] },
}

describe('webhook invoice.paid: the add-on first-period charge', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    h.inserts.length = 0
    h.insertErrors.length = 0
    h.profileUpdates.length = 0
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  it('books the 575 once: one ledger row (tip 0) and Total Paid +575', async () => {
    expect(await deliver(addonCharge)).toBe(200)
    expect(h.inserts).toEqual([{ profile_id: 'p1', stripe_invoice_id: 'in_addon', amount_cents: 575, tip_cents: 0 }])
    expect(h.profileUpdates).toEqual([expect.objectContaining({ cumulative_website_value_paid_cents: 1000 + 575 })])
  })

  it('a retried or replayed delivery (unique stripe_invoice_id, 23505) adds nothing', async () => {
    await deliver(addonCharge)
    h.insertErrors.push({ code: '23505' })
    await deliver(addonCharge)
    expect(h.profileUpdates).toHaveLength(1)
  })

  it('the next renewal is its own invoice with the add-on at the monthly price: counted once more, separately', async () => {
    await deliver(addonCharge)
    await deliver({
      id: 'in_renewal',
      customer: 'cus_1',
      billing_reason: 'subscription_cycle',
      amount_paid: 5500 + 575,
      parent: null,
      lines: { data: [{ amount: 5500, pricing: { price_details: { product: 'freeplug_priority', price: 'price_p' } } }, { amount: 575, pricing: { price_details: { product: 'freeplug_extra_big_change', price: 'price_big' } } }] },
    })
    expect(h.inserts.map((r) => [r.stripe_invoice_id, r.amount_cents])).toEqual([
      ['in_addon', 575],
      ['in_renewal', 6075],
    ])
  })
})
