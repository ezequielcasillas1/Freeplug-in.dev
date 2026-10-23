// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { memoryOwnershipStore, ownershipTotals, recordInvoicePayment, buyoutCreditCents } from './ownership'

/**
 * Cheke, Oct 23 2026 (corrected): on the $100 -> $35 downgrade the $50 goes EITHER toward the buyout OR to the
 * Freeplug wallet. Neither is a card refund, so the $100 charge stays whole in the ownership ledger.
 * - buyout: the full $100 counts toward ownership.
 * - wallet: the $100 counts too, and the $50 wallet credit then pays later bills; Stripe lowers those invoices'
 *   amount_paid, so the same $50 is never counted twice.
 */
describe('$100 -> $35 downgrade credit and the buyout total', () => {
  const day = (d: number) => Math.floor(Date.UTC(2026, 9, d) / 1000)
  it('buyout choice: the whole $100 (incl. the $50) counts; then the new $35', async () => {
    const store = memoryOwnershipStore()
    await recordInvoicePayment(store, 'p1', { id: 'in_100', amount_paid: 10000, status_transitions: { paid_at: day(1) } }, 'ch_100')
    await recordInvoicePayment(store, 'p1', { id: 'in_35', amount_paid: 3500, status_transitions: { paid_at: day(10) } }, 'ch_35')
    const rows = [...store.rows.values()]
    expect(ownershipTotals(rows, new Date(Date.UTC(2026, 9, 11))).paidCents).toBe(13500)
    expect(buyoutCreditCents(rows, new Date(Date.UTC(2026, 9, 16)))).toBe(10000)
  })
  it('wallet choice: $100 counts; the next $35 bill is paid from the wallet ($0 card) and adds nothing', async () => {
    const store = memoryOwnershipStore()
    await recordInvoicePayment(store, 'p1', { id: 'in_100', amount_paid: 10000, status_transitions: { paid_at: day(1) } }, 'ch_100')
    // new $35 period starts now: covered by the -$50 balance -> amount_paid 0 -> no ledger row
    expect(await recordInvoicePayment(store, 'p1', { id: 'in_35a', amount_paid: 0, status_transitions: { paid_at: day(10) } }, null)).toBe('unchanged')
    // next month: $15 left in the wallet, card pays $20
    await recordInvoicePayment(store, 'p1', { id: 'in_35b', amount_paid: 2000, status_transitions: { paid_at: day(40) } }, 'ch_35b')
    expect(ownershipTotals([...store.rows.values()], new Date(Date.UTC(2026, 11, 1))).paidCents).toBe(12000)
  })
})
