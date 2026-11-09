// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daysSince } from '@/lib/dashboard/customer-since'

/**
 * invoice.paid stamps billing_ledger.created_at with the payment time (Vera, Oct 4, 31d2736 Low 1):
 * status_transitions.paid_at ?? invoice.created, never the delivery time, so a late, retried or
 * replayed delivery does not move Customer Since (or the Recent activity date) forward.
 */
const h = vi.hoisted(() => ({ inserts: [] as Record<string, unknown>[], insertErrors: [] as (null | { code: string })[] }))
const constructEventAsync = vi.fn()

vi.mock('@/lib/stripe/server', () => ({ getStripe: () => ({ webhooks: { constructEventAsync } }) }))
vi.mock('@/lib/outreach/server', () => ({ handleOutreachInvoicePaid: async () => false, handleOutreachSetupSession: async () => false }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: RecordArgs) => {
      if (fn === 'record_ownership_entry') return { data: 'inserted', error: null } as never
      if (fn !== 'record_invoice_paid') throw new Error(`unexpected rpc ${fn}`)
      return recordInvoicePaidRpc(
        args,
        async (row) => (h.inserts.push(row), { error: h.insertErrors.shift() ?? null }),
        () => undefined
      )
    },
    from: (table: string) => {
      if (table === 'profiles') {
        const q = {
          select: () => q,
          eq: () => q,
          limit: async () => ({ data: [{ id: 'p1', cumulative_website_value_paid_cents: 0 }], error: null }),
          update: () => ({ eq: async () => ({ error: null }) }),
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
import { recordInvoicePaidRpc, type RecordArgs } from '../../../../../test/record-invoice-paid-rpc'

const T = (iso: string) => Math.floor(Date.parse(iso) / 1000)
const OCT3 = '2026-10-03T19:03:30.000Z'

async function deliver(invoice: Record<string, unknown>) {
  constructEventAsync.mockResolvedValue({
    id: 'evt_p',
    type: 'invoice.paid',
    data: { object: { id: 'in_1', customer: 'cus_1', amount_paid: 6500, lines: { data: [] }, ...invoice } },
  })
  const res = await POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' }))
  return res.status
}

describe('webhook invoice.paid: billing_ledger.created_at is the payment time (Vera, Oct 4)', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    h.inserts.length = 0
    h.insertErrors.length = 0
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('an Oct 3 payment delivered Oct 6 (retry) is stamped Oct 3, so Customer Since still reads 32d on Nov 4', async () => {
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
    expect(await deliver({ created: T('2026-10-03T19:03:28Z'), status_transitions: { paid_at: T(OCT3) } })).toBe(200)
    expect(h.inserts[0]).toMatchObject({ stripe_invoice_id: 'in_1', created_at: OCT3 })
    expect(daysSince(new Date(h.inserts[0].created_at as string), new Date('2026-11-04T20:00:00Z'))).toBe(32)
    // a delivery-time stamp (the old column default, Oct 6 12:00Z) would have read 29d
    expect(daysSince(new Date('2026-10-06T12:00:00Z'), new Date('2026-11-04T20:00:00Z'))).toBe(29)
  })

  it('paid_at null: falls back to invoice.created', async () => {
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
    await deliver({ created: T('2026-10-03T19:03:28Z'), status_transitions: { paid_at: null } })
    expect(h.inserts[0]).toMatchObject({ created_at: '2026-10-03T19:03:28.000Z' })
  })

  it('no status_transitions at all: invoice.created', async () => {
    await deliver({ created: T(OCT3) })
    expect(h.inserts[0]).toMatchObject({ created_at: OCT3 })
  })

  it('neither timestamp: no created_at, the column default applies (as before)', async () => {
    await deliver({})
    expect(h.inserts[0]).not.toHaveProperty('created_at')
  })

  it('phase 4 L-2/L-1: a failed record answers 500 and the Stripe retry still carries the payment time', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    h.insertErrors.push({ code: '08006' })
    expect(await deliver({ created: T(OCT3), status_transitions: { paid_at: T(OCT3) } })).toBe(500)
    expect(await deliver({ created: T(OCT3), status_transitions: { paid_at: T(OCT3) } })).toBe(200)
    expect(h.inserts).toHaveLength(2)
    expect(h.inserts[1]).toEqual({ profile_id: 'p1', stripe_invoice_id: 'in_1', amount_cents: 6500, tip_cents: 0, created_at: OCT3 })
  })
})
