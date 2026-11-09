// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Phase 4 L-1 (Vera): a failed profile lookup or ledger insert answers 500 so Stripe retries; an event
 * already processed answers 200 and does nothing; a bad signature stays 400. Mocks only.
 */
const h = vi.hoisted(() => ({
  processed: new Set<string>(),
  lookupError: null as null | { message: string },
  profileError: null as null | { message: string; code?: string },
  ledgerError: null as null | { message: string; code?: string },
  ledgerRows: [] as Record<string, unknown>[],
  profileUpdates: 0,
  rpcCalls: [] as unknown[],
  rpcError: null as null | { message: string; code?: string },
}))
const constructEventAsync = vi.fn()
vi.mock('@/lib/stripe/server', () => ({ getStripe: () => ({ webhooks: { constructEventAsync } }) }))
vi.mock('@/lib/outreach/server', () => ({ handleOutreachInvoicePaid: async () => false, handleOutreachSetupSession: async () => false }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'record_ownership_entry') return { data: 'inserted', error: null }
      h.rpcCalls.push([fn, args])
      if (h.rpcError) return { data: null, error: h.rpcError }
      const dup = h.ledgerRows.some((r) => r.stripe_invoice_id === args.p_stripe_invoice_id)
      if (!dup) {
        h.ledgerRows.push({ stripe_invoice_id: args.p_stripe_invoice_id })
        h.profileUpdates++
      }
      return { data: !dup, error: null }
    },
    from: (table: string) => {
      if (table === 'stripe_webhook_events') {
        const q = {
          select: () => q,
          eq: (_c: string, v: string) => ((q as { id?: string }).id = v, q),
          limit: async () => ({ data: h.lookupError ? null : h.processed.has((q as { id?: string }).id!) ? [{ event_id: (q as { id?: string }).id }] : [], error: h.lookupError }),
        }
        return { ...q, upsert: async (row: { event_id: string }) => (h.processed.add(row.event_id), { error: null }) }
      }
      if (table === 'profiles') {
        const q = {
          select: () => q,
          eq: () => q,
          limit: async () => ({ data: h.profileError ? null : [{ id: 'p1', cumulative_website_value_paid_cents: 0 }], error: h.profileError }),
          update: () => ({ eq: async () => (h.profileUpdates++, { error: null }) }),
        }
        return q
      }
      if (table === 'billing_ledger') {
        return {
          insert: async (row: Record<string, unknown>) => {
            if (h.ledgerError) return { error: h.ledgerError }
            if (h.ledgerRows.some((r) => r.stripe_invoice_id === row.stripe_invoice_id)) return { error: { code: '23505', message: 'dup' } }
            h.ledgerRows.push(row)
            return { error: null }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

import { POST } from './route'

const req = () => new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' })
function paid(eventId: string, invoiceId = 'in_1') {
  constructEventAsync.mockResolvedValue({ id: eventId, type: 'invoice.paid', data: { object: { id: invoiceId, customer: 'cus_1', amount_paid: 6500, created: 1790000000, lines: { data: [] } } } })
}

describe('Stripe webhook: retries and event idempotency (phase 4 L-1)', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret'
    Object.assign(h, { lookupError: null, profileError: null, ledgerError: null, rpcError: null, profileUpdates: 0 })
    h.processed.clear()
    h.ledgerRows.length = 0
    h.rpcCalls.length = 0
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('profile lookup error: 500 (Stripe retries), nothing saved, event not marked', async () => {
    h.profileError = { message: 'db down' }
    paid('evt_a')
    expect((await POST(req())).status).toBe(500)
    expect(h.ledgerRows).toHaveLength(0)
    expect(h.processed.has('evt_a')).toBe(false)
    // the retry after recovery goes through
    h.profileError = null
    expect((await POST(req())).status).toBe(200)
    expect(h.ledgerRows).toHaveLength(1)
    expect(h.processed.has('evt_a')).toBe(true)
  })

  it('ledger write error (not a duplicate): 500, total not incremented, event not marked', async () => {
    h.ledgerError = { code: '08006', message: 'connection failure' }
    h.rpcError = h.ledgerError
    paid('evt_b')
    expect((await POST(req())).status).toBe(500)
    expect(h.profileUpdates).toBe(0)
    expect(h.processed.has('evt_b')).toBe(false)
  })

  it('an event already processed answers 200 and does nothing', async () => {
    paid('evt_c')
    expect((await POST(req())).status).toBe(200)
    expect(h.ledgerRows).toHaveLength(1)
    const updates = h.profileUpdates
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ received: true, duplicate: true })
    expect(h.ledgerRows).toHaveLength(1)
    expect(h.profileUpdates).toBe(updates)
  })

  it('a different event for the same invoice is a no-op on the ledger and the total (200)', async () => {
    paid('evt_d1')
    expect((await POST(req())).status).toBe(200)
    const updates = h.profileUpdates
    paid('evt_d2')
    expect((await POST(req())).status).toBe(200)
    expect(h.ledgerRows).toHaveLength(1)
    expect(h.profileUpdates).toBe(updates)
  })

  it('processed-event store unavailable: still processed (handlers are idempotent), 200', async () => {
    h.lookupError = { message: 'store down' }
    paid('evt_e')
    expect((await POST(req())).status).toBe(200)
    expect(h.ledgerRows).toHaveLength(1)
  })

  it('bad signature stays 400 and touches nothing', async () => {
    constructEventAsync.mockRejectedValue(new Error('No signatures found'))
    expect((await POST(req())).status).toBe(400)
    expect(h.ledgerRows).toHaveLength(0)
    expect(h.processed.size).toBe(0)
  })
})
