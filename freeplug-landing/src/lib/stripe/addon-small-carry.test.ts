// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import type { AddonId } from '@/lib/plans/ladder'
import { addonCarriedBreakdown, addonRefundNote, addonTodayTotal } from '@/lib/plans/ladder-copy'
import { addonRefundOf, changeAddon, previewAddonChange, refundAddonCharge } from './change-plan'
import { createStripeSim, SIM_PRICE_ID } from '../../../test/stripe-addon-sim'

/**
 * Vera de173c8 M-1 (Aria ruling a) and L-3 (Sable, locked): an under-$0.50 amount after credit is carried
 * (Stripe's invoice_too_small debit) onto whatever charge comes next; the confirm shows the real total,
 * split out. A refund whose credit cancels a small charge still unbilled says so.
 */
const T0 = Math.floor(new Date('2026-10-04T14:00:00Z').getTime() / 1000)
const START = T0 - 10 * 86_400
type Sub = Parameters<typeof changeAddon>[1]

function setup(creditCents: number) {
  const sim = createStripeSim({ nowSec: T0 })
  sim.addCustomer('cus_1', creditCents)
  sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', addons: [], periodStart: START })
  const deps = { stripe: sim.client() as unknown as Stripe, addonPriceIdFor: async (id: AddonId) => SIM_PRICE_ID.addon(id), now: sim.now, log: () => {} }
  const live = () => sim.sub('sub_1') as unknown as Sub
  const balance = async () => ((await sim.client().customers.retrieve('cus_1')) as unknown as { balance: number }).balance
  return { sim, deps, live, balance }
}
type On = Extract<Awaited<ReturnType<typeof previewAddonChange>>, { action: 'on' }>
const on = (p: Awaited<ReturnType<typeof previewAddonChange>>) => {
  if (!p.ok || p.action !== 'on') throw new Error(`not an on preview: ${JSON.stringify(p)}`)
  return p as On
}

describe('Vera M-1 repro: $5.40 credit, Big change, then +1 small edit in the same period', () => {
  it('the second confirm shows what the card is charged: $5.35 today, $5.00 + $0.35 left from your last change', async () => {
    const { sim, deps, live } = setup(540)
    const pv1 = on(await previewAddonChange(deps, live(), 'big_change', 'on', T0))
    expect(pv1).toMatchObject({ amountDueCents: 35, fullCents: 575, carriedCents: 0 })
    const r1 = await changeAddon(deps, live(), 'big_change', 'on', { prorationDate: pv1.prorationDate })
    expect(r1).toMatchObject({ ok: true, kind: 'on', deferredCents: 35 })
    expect(sim.balanceTransactions).toEqual([expect.objectContaining({ type: 'invoice_too_small', amount: 35 })])

    const pv2 = on(await previewAddonChange(deps, live(), 'small_edit', 'on', T0))
    expect(pv2).toMatchObject({ amountDueCents: 535, fullCents: 500, carriedCents: 35 }) // no longer capped at $5
    expect(addonTodayTotal(pv2.amountDueCents)).toBe('$5.35 today')
    expect(addonCarriedBreakdown(pv2.amountDueCents - pv2.carriedCents, pv2.carriedCents)).toBe('$5.00 + $0.35 left from your last change')

    const r2 = await changeAddon(deps, live(), 'small_edit', 'on', { prorationDate: pv2.prorationDate })
    expect(r2).toMatchObject({ ok: true, kind: 'on' })
    expect(r2).not.toHaveProperty('deferredCents')
    const inv2 = sim.invoices().find((i) => i.id === (r2 as { invoiceId: string }).invoiceId)!
    expect(inv2).toMatchObject({ total: 500, starting_balance: 35, amount_paid: 535 })
    expect(inv2.amount_paid).toBe(pv2.amountDueCents) // the confirm equals the charge
  })

  it('nothing carried: the preview is the plain price (no split)', async () => {
    const { deps, live } = setup(0)
    expect(on(await previewAddonChange(deps, live(), 'small_edit', 'on', T0))).toMatchObject({ amountDueCents: 500, fullCents: 500, carriedCents: 0 })
  })
})

describe('L-3 (Sable): the refund split line when the credit cancels a small charge', () => {
  const NAME = 'Big change'
  it('still unbilled (the debit is on the account): the third line, no delay line; the credit only goes back to $5.40', async () => {
    const { sim, deps, live, balance } = setup(540)
    const r1 = await changeAddon(deps, live(), 'big_change', 'on', {})
    expect(await balance()).toBe(35) // the unbilled small charge
    const inv = sim.invoices().find((i) => i.id === (r1 as { invoiceId: string }).invoiceId)!
    expect(await refundAddonCharge(deps.stripe, inv.id, inv.amount_paid, inv.total, () => {}, 'not_added')).toMatchObject({ ok: true, cardCents: 0, creditCents: 575 })
    expect(await balance()).toBe(-540)
    const fresh = sim.invoices().find((i) => i.id === inv.id)!
    expect(fresh.metadata.addon_refund_carried_cents).toBe('35')
    const x = addonRefundOf(fresh)!
    expect(x).toMatchObject({ cardCents: 0, creditCents: 575, carriedCents: 35 })
    const note = addonRefundNote(NAME, x.reason, x.cardCents, x.creditCents, x.carriedCents)
    expect(note).toBe(
      "We couldn't turn on Big change because of a problem adding it to your plan. We added $5.40 back to your account credit and canceled the $0.35 small charge, so you won't pay it."
    )
    expect(note).not.toContain('business days')
  })

  it('already paid on a bill (the next charge collected it): the existing credit line, no carried mark', async () => {
    const { sim, deps, live, balance } = setup(540)
    const r1 = await changeAddon(deps, live(), 'big_change', 'on', {})
    await changeAddon(deps, live(), 'small_edit', 'on', {}) // charged $5.35: the $0.35 is paid
    expect(await balance()).toBe(0)
    const inv = sim.invoices().find((i) => i.id === (r1 as { invoiceId: string }).invoiceId)!
    expect(await refundAddonCharge(deps.stripe, inv.id, inv.amount_paid, inv.total, () => {}, 'not_added')).toMatchObject({ ok: true, cardCents: 0, creditCents: 575 })
    const x = addonRefundOf(sim.invoices().find((i) => i.id === inv.id)!)!
    expect(x).not.toHaveProperty('carriedCents')
    expect(addonRefundNote(NAME, x.reason, x.cardCents, x.creditCents, x.carriedCents ?? 0)).toBe(
      "We couldn't turn on Big change because of a problem adding it to your plan. We added $5.75 back to your account credit."
    )
  })

  it('no small charge at all (paid by card): the card line and the delay line, unchanged', async () => {
    const { sim, deps, live } = setup(0)
    const r1 = await changeAddon(deps, live(), 'big_change', 'on', {})
    const inv = sim.invoices().find((i) => i.id === (r1 as { invoiceId: string }).invoiceId)!
    expect(await refundAddonCharge(deps.stripe, inv.id, inv.amount_paid, inv.total, () => {}, 'not_added')).toMatchObject({ ok: true, cardCents: 575, creditCents: 0 })
    const x = addonRefundOf(sim.invoices().find((i) => i.id === inv.id)!)!
    expect(addonRefundNote(NAME, x.reason, x.cardCents, x.creditCents, x.carriedCents ?? 0)).toBe(
      "We couldn't turn on Big change because of a problem adding it to your plan. We refunded $5.75 to your card. The card refund can take 5–10 business days to show up."
    )
  })

  it('the balance read fails: the refund still goes through, with the standard line (logged)', async () => {
    const { sim, deps, live } = setup(540)
    const r1 = await changeAddon(deps, live(), 'big_change', 'on', {})
    const inv = sim.invoices().find((i) => i.id === (r1 as { invoiceId: string }).invoiceId)!
    const c = sim.client()
    const broken = { ...c, customers: { retrieve: () => Promise.reject(new Error('stripe 500 (simulated)')) } } as unknown as Stripe
    const logs: string[] = []
    expect(await refundAddonCharge(broken, inv.id, inv.amount_paid, inv.total, (m) => logs.push(m), 'not_added')).toMatchObject({ ok: true })
    expect(sim.creditNotes).toHaveLength(1)
    expect(addonRefundOf(sim.invoices().find((i) => i.id === inv.id)!)).not.toHaveProperty('carriedCents')
    expect(logs.some((m) => m.includes('balance read before the refund failed'))).toBe(true)
  })
})
