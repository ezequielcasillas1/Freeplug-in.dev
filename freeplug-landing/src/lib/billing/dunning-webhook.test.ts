// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import { memoryDunningStore } from './dunning'
import { dunningFromInvoiceEvent } from './dunning-webhook'
import { cronAuthorized } from '@/app/api/cron/dunning/route'

const inv = (o: Record<string, unknown> = {}) => ({ id: 'in_1', customer: 'cus_1', parent: { subscription_details: { subscription: 'sub_1' } }, metadata: {}, ...o }) as unknown as Stripe.Invoice
const T0 = new Date('2026-11-01T15:00:00Z')

describe('dunning from invoice webhooks', () => {
  it('payment_failed opens, paid closes', async () => {
    const store = memoryDunningStore()
    expect(await dunningFromInvoiceEvent(store, 'invoice.payment_failed', inv(), async () => 'p1', T0)).toBe('opened')
    expect(await dunningFromInvoiceEvent(store, 'invoice.payment_failed', inv(), async () => 'p1', new Date(T0.getTime() + 3 * 86_400_000))).toBe('already_open')
    expect(await dunningFromInvoiceEvent(store, 'invoice.paid', inv(), async () => null, new Date(T0.getTime() + 5 * 86_400_000))).toBe('resolved')
    expect(store.rows[0].resolved_at).not.toBeNull()
  })
  it('ignores non-subscription and maintenance quote invoices, and unknown customers', async () => {
    const store = memoryDunningStore()
    expect(await dunningFromInvoiceEvent(store, 'invoice.payment_failed', inv({ parent: null }), async () => 'p1')).toBe('skipped')
    expect(await dunningFromInvoiceEvent(store, 'invoice.payment_failed', inv({ metadata: { maintenance_quote_id: 'q1' } }), async () => 'p1')).toBe('skipped')
    expect(await dunningFromInvoiceEvent(store, 'invoice.payment_failed', inv(), async () => null)).toBe('skipped')
    expect(store.rows).toHaveLength(0)
  })
  it('legacy invoice.subscription field works too', async () => {
    const store = memoryDunningStore()
    expect(await dunningFromInvoiceEvent(store, 'invoice.payment_failed', inv({ parent: null, subscription: 'sub_9' }), async () => 'p1')).toBe('opened')
  })
})

describe('cron auth', () => {
  it('refuses without a configured secret or a wrong one', () => {
    expect(cronAuthorized('Bearer x', undefined)).toBe(false)
    expect(cronAuthorized('Bearer short', 'short')).toBe(false)
    expect(cronAuthorized('Bearer wrong-wrong-wrong-1', 'right-right-right-1')).toBe(false)
    expect(cronAuthorized(null, 'right-right-right-1')).toBe(false)
    expect(cronAuthorized('Bearer right-right-right-1', 'right-right-right-1')).toBe(true)
  })
})
