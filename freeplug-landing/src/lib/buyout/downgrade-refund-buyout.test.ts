// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { memoryOwnershipStore, ownershipTotals, recordInvoicePayment, recordRefunds, buyoutCreditCents } from './ownership'

/**
 * Cheke, Oct 23 2026: on the $100 -> $35 downgrade the client keeps paying for half the month ($50 retained)
 * and gets $50 back on the card. The retained $50 counts toward the buyout (every dollar paid counts);
 * the refunded $50 does not (it went back to them).
 */
describe('$100 -> $35 downgrade refund and the buyout total', () => {
  const day = (d: number) => Math.floor(Date.UTC(2026, 9, d) / 1000)
  async function setup() {
    const store = memoryOwnershipStore()
    await recordInvoicePayment(store, 'p1', { id: 'in_100', amount_paid: 10000, status_transitions: { paid_at: day(1) } }, 'ch_100')
    await recordRefunds(store, { id: 'ch_100', amount: 10000, created: day(1) }, [{ id: 're_50', amount: 5000, status: 'succeeded', created: day(10), charge: 'ch_100' }])
    await recordInvoicePayment(store, 'p1', { id: 'in_35', amount_paid: 3500, status_transitions: { paid_at: day(10) } }, 'ch_35')
    return [...store.rows.values()]
  }
  it('retained $50 + the new $35 count toward ownership; the $50 refund does not', async () => {
    const rows = await setup()
    expect(ownershipTotals(rows, new Date(Date.UTC(2026, 9, 11))).paidCents).toBe(5000 + 3500)
  })
  it('the retained $50 becomes buyout-eligible once its charge clears (14 days)', async () => {
    const rows = await setup()
    expect(buyoutCreditCents(rows, new Date(Date.UTC(2026, 9, 16)))).toBe(5000)
    expect(buyoutCreditCents(rows, new Date(Date.UTC(2026, 9, 25)))).toBe(8500)
  })
  it('a replayed refund webhook does not subtract twice', async () => {
    const store = memoryOwnershipStore()
    await recordInvoicePayment(store, 'p1', { id: 'in_100', amount_paid: 10000, status_transitions: { paid_at: day(1) } }, 'ch_100')
    const r = { id: 're_50', amount: 5000, status: 'succeeded', created: day(10), charge: 'ch_100' }
    await recordRefunds(store, { id: 'ch_100', amount: 10000, created: day(1) }, [r])
    await recordRefunds(store, { id: 'ch_100', amount: 10000, created: day(1) }, [r])
    expect(ownershipTotals([...store.rows.values()]).paidCents).toBe(5000)
  })
})
