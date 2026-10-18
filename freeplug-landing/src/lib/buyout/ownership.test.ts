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
  recordRefundObject,
  recordRefunds,
  buyoutCreditCents,
  OWNERSHIP_NOTE,
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

  it('refunds are keyed per refund id (Aria): two partials subtract separately, replays change nothing', async () => {
    const s = memoryOwnershipStore()
    await recordInvoicePayment(s, P, inv(), 'ch_1')
    const re1 = { id: 're_1', amount: 1000, status: 'succeeded', created: unix(T0) }
    const re2 = { id: 're_2', amount: 2500, status: 'succeeded', created: unix(T0) }
    await recordRefunds(s, charge({ amount_refunded: 1000 }), [re1])
    expect(total(s).paidCents).toBe(2500)
    await recordRefunds(s, charge({ amount_refunded: 1000 }), [re1]) // duplicate event
    expect(total(s).paidCents).toBe(2500)
    await recordRefunds(s, charge({ amount_refunded: 3500 }), [re1, re2]) // second refund; charge lists both
    expect(total(s).paidCents).toBe(0)
    expect([...s.rows.keys()].filter((k) => k.startsWith('refund:')).sort()).toEqual(['refund:re_1', 'refund:re_2'])
    expect(s.rows.get('refund:re_1')!.amount_cents).toBe(-1000)
    await recordRefundObject(s, { ...re1, charge: 'ch_1' }, null) // refund.updated replay
    expect(total(s).paidCents).toBe(0)
  })

  it('a failed refund is restored and stays restored', async () => {
    const s = memoryOwnershipStore()
    await recordInvoicePayment(s, P, inv(), 'ch_1')
    await recordRefundObject(s, { id: 're_9', amount: 1500, status: 'pending', created: unix(T0), charge: 'ch_1' }, 3500)
    expect(total(s).paidCents).toBe(2000)
    await recordRefundObject(s, { id: 're_9', amount: 1500, status: 'failed', created: unix(T0), charge: 'ch_1' }, 3500)
    expect(total(s).paidCents).toBe(3500)
    await recordRefundObject(s, { id: 're_9', amount: 1500, status: 'pending', created: unix(T0), charge: 'ch_1' }, 3500) // late replay
    expect(total(s).paidCents).toBe(3500)
  })

  it('buyout eligibility counts cleared payments only; refunds subtract right away', async () => {
    const s = memoryOwnershipStore()
    await recordInvoicePayment(s, P, inv(), 'ch_1') // $35 at T0
    const day = (n: number) => new Date(T0 + n * 86_400_000)
    expect(buyoutCreditCents([...s.rows.values()], day(13))).toBe(0)
    expect(buyoutCreditCents([...s.rows.values()], day(CLEARING_DAYS))).toBe(3500)
    await recordRefundObject(s, { id: 're_3', amount: 1000, status: 'succeeded', created: unix(T0), charge: 'ch_1' }, 3500)
    expect(buyoutCreditCents([...s.rows.values()], day(1))).toBe(0) // still clearing: 0, never below 0
    expect(buyoutCreditCents([...s.rows.values()], day(CLEARING_DAYS))).toBe(2500)
    // A refund of a payment still clearing doesn't eat into other cleared money.
    const rows = [
      { kind: 'payment' as const, amount_cents: 3500, clears_at: day(-1).toISOString(), stripe_charge_id: 'ch_old' },
      { kind: 'payment' as const, amount_cents: 2500, clears_at: day(10).toISOString(), stripe_charge_id: 'ch_new' },
      { kind: 'refund' as const, amount_cents: -2500, clears_at: null, stripe_charge_id: 'ch_new' },
    ]
    expect(buyoutCreditCents(rows, day(0))).toBe(3500)
    expect(OWNERSHIP_NOTE).toBe("Payments count after 14 days. Refunds aren't counted.")
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
    expect(ownershipTotals([...s.rows.values()])).toEqual({ paidCents: 3500, clearingCents: 3500, clearedCents: 0 })
    vi.setSystemTime(day(CLEARING_DAYS - 1))
    expect(ownershipTotals([...s.rows.values()]).clearingCents).toBe(3500)
    vi.setSystemTime(day(CLEARING_DAYS))
    expect(ownershipTotals([...s.rows.values()])).toEqual({ paidCents: 3500, clearingCents: 0, clearedCents: 3500 })
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

describe('per-charge totals (QA r2): customer line and eligibility agree', () => {
  const NOW = new Date('2026-10-18T12:00:00Z')
  const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000)
  const pay = (id: string, cents: number, paidDaysAgo: number) => ({ kind: 'payment' as const, amount_cents: cents, stripe_charge_id: id, clears_at: new Date(ago(paidDaysAgo).getTime() + CLEARING_DAYS * 86_400_000).toISOString() })
  const adj = (id: string, cents: number, kind: 'refund' | 'dispute' = 'refund') => ({ kind, amount_cents: cents, stripe_charge_id: id, clears_at: null })
  it.each([
    ['A 5000, B 3000 fully refunded', [pay('A', 5000, 20), pay('B', 3000, 5), adj('B', -3000)], { paidCents: 5000, clearingCents: 0, clearedCents: 5000 }],
    ['refund 2000 on cleared A', [pay('A', 5000, 20), pay('B', 3000, 5), adj('A', -2000)], { paidCents: 6000, clearingCents: 3000, clearedCents: 3000 }],
    ['refund 1000 on pending B', [pay('A', 5000, 20), pay('B', 3000, 5), adj('B', -1000)], { paidCents: 7000, clearingCents: 2000, clearedCents: 5000 }],
    ['open dispute on pending B', [pay('A', 5000, 20), pay('B', 3000, 5), adj('B', -3000, 'dispute')], { paidCents: 5000, clearingCents: 0, clearedCents: 5000 }],
    ['orphan refund/dispute subtracts nothing', [pay('A', 5000, 20), adj('Z', -4000), adj('Y', -700, 'dispute')], { paidCents: 5000, clearingCents: 0, clearedCents: 5000 }],
  ])('%s', (_name, rows, want) => {
    expect(ownershipTotals(rows, NOW)).toEqual(want)
    expect(buyoutCreditCents(rows, NOW)).toBe(want.clearedCents)
  })
})
