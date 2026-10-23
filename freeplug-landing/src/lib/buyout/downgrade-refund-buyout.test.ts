// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { memoryOwnershipStore, ownershipTotals, recordInvoicePayment, recordRefunds, buyoutCreditCents } from './ownership'

/**
 * Cheke, Oct 23 2026 (final): on the $100 -> $35 downgrade the $50 goes EITHER toward the buyout OR back
 * as a real refund to the original payment method.
 * - buyout: no money moves; the full $100 counts toward ownership.
 * - refund: $50 is refunded on the $100 charge; only the $50 kept counts (ledger is net of refunds).
 */
describe('$100 -> $35 downgrade choice and the buyout total', () => {
  const day = (d: number) => Math.floor(Date.UTC(2026, 9, d) / 1000)
  it('buyout choice: the whole $100 (incl. the $50) counts; then the new $35', async () => {
    const store = memoryOwnershipStore()
    await recordInvoicePayment(store, 'p1', { id: 'in_100', amount_paid: 10000, status_transitions: { paid_at: day(1) } }, 'ch_100')
    await recordInvoicePayment(store, 'p1', { id: 'in_35', amount_paid: 3500, status_transitions: { paid_at: day(10) } }, 'ch_35')
    const rows = [...store.rows.values()]
    expect(ownershipTotals(rows, new Date(Date.UTC(2026, 9, 11))).paidCents).toBe(13500)
    expect(buyoutCreditCents(rows, new Date(Date.UTC(2026, 9, 16)))).toBe(10000)
  })
  it('refund choice: $50 refunded on the $100 charge -> only $50 of it counts; then the new $35', async () => {
    const store = memoryOwnershipStore()
    await recordInvoicePayment(store, 'p1', { id: 'in_100', amount_paid: 10000, status_transitions: { paid_at: day(1) } }, 'ch_100')
    await recordRefunds(store, { id: 'ch_100', amount: 10000 } as never, [{ id: 're_1', amount: 5000, status: 'succeeded', created: day(2) }])
    await recordInvoicePayment(store, 'p1', { id: 'in_35', amount_paid: 3500, status_transitions: { paid_at: day(10) } }, 'ch_35')
    expect(ownershipTotals([...store.rows.values()], new Date(Date.UTC(2026, 9, 11))).paidCents).toBe(8500)
  })
})
