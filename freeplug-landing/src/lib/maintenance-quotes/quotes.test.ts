import { describe, expect, it, vi } from 'vitest'
import { assertTestModeKey, markQuoteInvoice, parseQuoteAmount, sendQuote, voidQuote, type MaintenanceQuote, type QuoteStore, type QuoteStripe } from './quotes'

function setup() {
  const q: MaintenanceQuote = {
    id: '11111111-1111-4111-8111-111111111111', change_request_id: 'cr1', user_id: 'u1', amount_cents: 7500, description: 'New gallery page',
    days_until_due: 7, status: 'draft', stripe_invoice_id: null, send_started_at: null, sent_at: null, paid_at: null, voided_at: null, created_at: '',
  }
  const store: QuoteStore = {
    get: async () => ({ ...q }),
    claimSend: async (_id, now) => {
      if (q.status !== 'draft' || q.send_started_at) return false
      q.send_started_at = now
      return true
    },
    releaseSend: async () => void (q.send_started_at = null),
    markSent: async (_id, inv, now) => void Object.assign(q, { status: 'unpaid', stripe_invoice_id: inv, sent_at: now }),
    markVoid: async (_id, now) => void Object.assign(q, { status: 'void', voided_at: now }),
    stripeCustomerFor: async () => 'cus_test_1',
  }
  const stripe = {
    invoices: {
      create: vi.fn(async () => ({ id: 'in_test_1' })),
      finalizeInvoice: vi.fn(async () => ({ id: 'in_test_1', status: 'open' })),
      sendInvoice: vi.fn(async () => ({ id: 'in_test_1' })),
      voidInvoice: vi.fn(async () => ({ id: 'in_test_1' })),
    },
    invoiceItems: { create: vi.fn(async () => ({ id: 'ii_1' })) },
  } satisfies QuoteStripe
  return { q, store, stripe }
}

describe('maintenance quotes', () => {
  it('Send creates a send_invoice invoice due in 7 days; a double Send is a no-op', async () => {
    const { q, store, stripe } = setup()
    const [a, b] = await Promise.all([sendQuote(store, stripe, q.id), sendQuote(store, stripe, q.id)])
    const c = await sendQuote(store, stripe, q.id)
    expect([a, b].filter((r) => r.ok && r.outcome === 'sent')).toHaveLength(1)
    expect(c).toEqual({ ok: true, outcome: 'noop', invoiceId: 'in_test_1' })
    expect(stripe.invoices.create).toHaveBeenCalledTimes(1)
    expect(stripe.invoices.create.mock.calls[0]).toEqual([
      expect.objectContaining({ customer: 'cus_test_1', collection_method: 'send_invoice', days_until_due: 7 }),
      { idempotencyKey: `maintenance-quote-${q.id}-invoice` },
    ])
    expect(stripe.invoiceItems.create).toHaveBeenCalledTimes(1)
    expect(stripe.invoices.sendInvoice).toHaveBeenCalledTimes(1)
    expect(q.status).toBe('unpaid')
  })
  it('Void voids the Stripe invoice once', async () => {
    const { q, store, stripe } = setup()
    await sendQuote(store, stripe, q.id)
    expect(await voidQuote(store, stripe, q.id)).toEqual({ ok: true })
    expect(await voidQuote(store, stripe, q.id)).toEqual({ ok: true })
    expect(stripe.invoices.voidInvoice).toHaveBeenCalledTimes(1)
  })
  it('only test keys, $50-$100 amounts', () => {
    expect(() => assertTestModeKey('sk_live_x')).toThrow()
    expect(() => assertTestModeKey('rk_live_x')).toThrow()
    expect(() => assertTestModeKey('sk_test_x')).not.toThrow()
    expect(parseQuoteAmount('75')).toEqual({ ok: true, cents: 7500 })
    expect(parseQuoteAmount('$100.00')).toEqual({ ok: true, cents: 10000 })
    expect(parseQuoteAmount('49').ok).toBe(false)
  })
  it('duplicate invoice.paid webhook marks the quote Paid once', async () => {
    let status = 'unpaid'
    const db = {
      from: () => ({
        update: (v: Record<string, unknown>) => ({
          eq: () => ({
            neq: (_k: string, s: string) => ({
              select: async () => {
                if (status === s) return { data: [], error: null }
                status = v.status as string
                return { data: [{ id: 'q' }], error: null }
              },
            }),
          }),
        }),
      }),
    }
    expect(await markQuoteInvoice(db as never, 'in_1', 'paid', 'now')).toBe(true)
    expect(await markQuoteInvoice(db as never, 'in_1', 'paid', 'now')).toBe(false)
    expect(status).toBe('paid')
  })
})

describe('Sable wording (Oct 18 QA)', () => {
  it('button, confirm with customer, badges, void confirm and the sent toast with due date', async () => {
    const q = await import('./quotes')
    expect(q.QUOTE_SEND_LABEL).toBe('Send quote')
    expect(q.quoteSendConfirmText('Gracias Lawn Service', 7500)).toBe('Send this quote to Gracias Lawn Service for $75? They get a Stripe invoice and have 7 days to pay.')
    expect(q.quoteSendConfirmText('Gracias Lawn Service', 7550)).toContain('for $75.50?')
    expect(q.QUOTE_CONFIRM_SEND_LABEL).toBe('Send')
    expect(q.QUOTE_BADGE.unpaid.label).toBe('Sent, unpaid')
    expect(q.QUOTE_BADGE.void.label).toBe('Void')
    expect(q.QUOTE_VOID_CONFIRM).toBe("Void this quote? The invoice can't be paid after this.")
    expect(q.quoteSentToast(new Date('2026-10-18T17:00:00Z'))).toBe("Quote sent. It's due Oct 25, 2026.")
  })
})

