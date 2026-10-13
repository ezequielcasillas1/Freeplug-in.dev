// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The tipping system (Oct 3): invoice.paid records the tip part of each payment in billing_ledger.tip_cents. */
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

const tipLine = (amount: number) => ({ amount, pricing: { price_details: { product: 'freeplug_tip', price: 'price_tip' } } })
const stepLine = (amount: number) => ({ amount, pricing: { price_details: { product: 'freeplug_fast_lane', price: 'price_fl' } } })

async function paid(lines: unknown[], amount_paid: number) {
  constructEventAsync.mockResolvedValue({
    id: 'evt_t',
    type: 'invoice.paid',
    data: { object: { id: 'in_1', customer: 'cus_1', amount_paid, lines: { data: lines } } },
  })
  const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' }))
  return res.status
}

describe('webhook invoice.paid: billing_ledger.tip_cents (the tipping system)', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    h.inserts.length = 0
    h.insertErrors.length = 0
    h.profileUpdates.length = 0
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  it('Fast lane $65 + $5 tip: ledger amount 7000 with tip_cents 500; the Total Paid counter adds everything paid, tip included (7000)', async () => {
    expect(await paid([stepLine(6500), tipLine(500)], 7000)).toBe(200)
    expect(h.inserts).toEqual([{ profile_id: 'p1', stripe_invoice_id: 'in_1', amount_cents: 7000, tip_cents: 500 }])
    expect(h.profileUpdates[0]).toMatchObject({ cumulative_website_value_paid_cents: 1000 + 7000 })
  })

  it('no tip: the counter adds the amount paid', async () => {
    await paid([stepLine(6500)], 6500)
    expect(h.profileUpdates[0]).toMatchObject({ cumulative_website_value_paid_cents: 1000 + 6500 })
  })

  it('no tip line: tip_cents 0', async () => {
    await paid([stepLine(6500)], 6500)
    expect(h.inserts[0]).toMatchObject({ amount_cents: 6500, tip_cents: 0 })
  })

  it('tip_cents never exceeds what was paid (the DB check is 0..amount)', async () => {
    await paid([stepLine(-6000), tipLine(900)], 400)
    expect(h.inserts[0]).toMatchObject({ amount_cents: 400, tip_cents: 400 })
    expect(h.profileUpdates[0]).toMatchObject({ cumulative_website_value_paid_cents: 1000 + 400 })
  })

  it.each(['42703', 'PGRST204'])('before the migration (%s): the row is saved without tip_cents, never lost', async (code) => {
    h.insertErrors.push({ code })
    expect(await paid([stepLine(6500), tipLine(500)], 7000)).toBe(200)
    expect(h.inserts).toEqual([
      { profile_id: 'p1', stripe_invoice_id: 'in_1', amount_cents: 7000, tip_cents: 500 },
      { profile_id: 'p1', stripe_invoice_id: 'in_1', amount_cents: 7000 },
    ])
    expect(h.profileUpdates).toHaveLength(1)
  })

  it('a duplicate (23505) is not retried without the column and adds nothing', async () => {
    h.insertErrors.push({ code: '23505' })
    await paid([tipLine(500)], 500)
    expect(h.inserts).toHaveLength(1)
    expect(h.profileUpdates).toHaveLength(0)
  })
})
