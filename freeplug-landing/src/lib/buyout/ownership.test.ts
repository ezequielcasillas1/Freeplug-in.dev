import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CLEARING_DAYS,
  chargeIdOfInvoice,
  memoryOwnershipStore,
  ownershipTotals,
  paidTowardOwnershipLine,
  recordChargePayment,
  recordDispute,
  recordInvoicePayment,
  recordRefund,
  stillClearingLine,
} from './ownership'

const P = 'profile-1'
const T0 = Date.parse('2026-10-01T15:00:00Z')
const unix = (ms: number) => Math.floor(ms / 1000)
const inv = (over: Record<string, unknown> = {}) => ({ id: 'in_1', amount_paid: 3500, status_transitions: { paid_at: unix(T0) }, created: unix(T0), ...over })
const charge = (over: Record<string, unknown> = {}) => ({ id: 'ch_1', amount: 3500, amount_refunded: 0, paid: true, status: 'succeeded', captured: true, created: unix(T0), ...over })
const total = (s: ReturnType<typeof memoryOwnershipStore>, now = new Date(T0)) => ownershipTotals([...s.rows.values()], now)

afterEach(() => vi.useRealTimers())

describe('ownership ledger (every dollar toward buyout)', () => {
  it('duplicate webhook events (same invoice.paid, same charge.succeeded) count once', async () => {
    const s = memoryOwnershipStore()
    expect(await recordInvoicePayment(s, P, inv(), 'ch_1')).toBe('inserted')
    expect(await recordInvoicePayment(s, P, inv(), 'ch_1')).toBe('unchanged')
    expect(await recordChargePayment(s, P, charge())).toBe('unchanged')
    expect(await recordChargePayment(s, P, charge())).toBe('unchanged')
    expect(total(s).paidCents).toBe(3500)
  })

  it('an invoice and its charge are counted once, whichever arrives first (invoice amount before tax wins)', async () => {
    const s = memoryOwnershipStore()
    // charge first: $37.80 incl. $2.80 tax; then the invoice says $35.00 before tax
    await recordChargePayment(s, P, charge({ amount: 3780 }))
    expect(await recordInvoicePayment(s, P, inv({ amount_paid: 3780, total_taxes: [{ amount: 280 }] }), 'ch_1')).toBe('updated')
    expect(s.rows.size).toBe(1)
    expect(total(s).paidCents).toBe(3500)
    // a late charge replay never overwrites the invoice amount
    expect(await recordChargePayment(s, P, charge({ amount: 3780 }))).toBe('unchanged')
    expect(total(s).paidCents).toBe(3500)
  })

  it('a tip on the invoice counts toward ownership (amount paid, not net of fees)', async () => {
    const s = memoryOwnershipStore()
    await recordInvoicePayment(s, P, inv({ amount_paid: 3500 + 400 }), 'ch_1') // $35 plan + $4 tip
    expect(total(s).paidCents).toBe(3900)
  })

  it('partial then full refund subtract, replays change nothing', async () => {
    const s = memoryOwnershipStore()
    await recordInvoicePayment(s, P, inv(), 'ch_1')
    await recordRefund(s, charge({ amount_refunded: 1000 }))
    expect(total(s).paidCents).toBe(2500)
    await recordRefund(s, charge({ amount_refunded: 1000 })) // duplicate event
    expect(total(s).paidCents).toBe(2500)
    await recordRefund(s, charge({ amount_refunded: 3500 })) // now full
    expect(total(s).paidCents).toBe(0)
    await recordRefund(s, charge({ amount_refunded: 1000 })) // out-of-order old event can't add money back
    expect(total(s).paidCents).toBe(0)
  })

  it('dispute lost subtracts for good; dispute won restores', async () => {
    const lost = memoryOwnershipStore()
    await recordInvoicePayment(lost, P, inv(), 'ch_1')
    await recordDispute(lost, { id: 'dp_1', charge: 'ch_1', amount: 3500, status: 'needs_response', created: unix(T0) })
    expect(total(lost).paidCents).toBe(0)
    await recordDispute(lost, { id: 'dp_1', charge: 'ch_1', amount: 3500, status: 'lost', created: unix(T0) })
    await recordDispute(lost, { id: 'dp_1', charge: 'ch_1', amount: 3500, status: 'needs_response', created: unix(T0) }) // late replay
    expect(total(lost).paidCents).toBe(0)

    const won = memoryOwnershipStore()
    await recordInvoicePayment(won, P, inv(), 'ch_1')
    await recordDispute(won, { id: 'dp_2', charge: 'ch_1', amount: 3500, status: 'needs_response', created: unix(T0) })
    expect(total(won).paidCents).toBe(0)
    await recordDispute(won, { id: 'dp_2', charge: 'ch_1', amount: 3500, status: 'won', created: unix(T0) })
    await recordDispute(won, { id: 'dp_2', charge: 'ch_1', amount: 3500, status: 'under_review', created: unix(T0) }) // late replay
    expect(total(won).paidCents).toBe(3500)
  })

  it('payments are still clearing until day 14, then cleared (mocked clock)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    const s = memoryOwnershipStore()
    await recordInvoicePayment(s, P, inv(), 'ch_1')
    const day = (n: number) => new Date(T0 + n * 86_400_000)
    expect(ownershipTotals([...s.rows.values()])).toEqual({ paidCents: 3500, clearingCents: 3500 })
    vi.setSystemTime(day(CLEARING_DAYS - 1))
    expect(ownershipTotals([...s.rows.values()]).clearingCents).toBe(3500)
    vi.setSystemTime(day(CLEARING_DAYS))
    expect(ownershipTotals([...s.rows.values()])).toEqual({ paidCents: 3500, clearingCents: 0 })
    expect(paidTowardOwnershipLine(3500)).toBe('Paid toward ownership: $35')
    expect(stillClearingLine(1250)).toBe('(includes $12.50 still clearing)')
  })

  it('finds the charge of an invoice through invoice payments and the PaymentIntent', async () => {
    const stripe = {
      invoicePayments: { list: vi.fn(async () => ({ data: [{ status: 'paid', payment: { payment_intent: 'pi_1' } }] })) },
      paymentIntents: { retrieve: vi.fn(async () => ({ latest_charge: 'ch_9' })) },
    }
    expect(await chargeIdOfInvoice({ id: 'in_9' }, stripe)).toBe('ch_9')
    expect(await chargeIdOfInvoice({ id: 'in_8', charge: 'ch_legacy' }, stripe)).toBe('ch_legacy')
  })
})
