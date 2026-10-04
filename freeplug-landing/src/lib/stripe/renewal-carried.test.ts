// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import type { AddonId } from '@/lib/plans/ladder'
import { renewalCarriedLine } from '@/lib/plans/ladder-copy'
import { changeAddon, changeTip, previewTipChange } from './change-plan'
import { carriedPendingCents, upcomingBill } from './next-bill'
import { createStripeSim, SIM_PRICE_ID } from '../../../test/stripe-addon-sim'

/**
 * Aria, Oct 4 2:40 PM CT (Sable's final two-line wording): while a small amount carried from the last
 * change is still unbilled, the renewal line ("Your next bill will be {total} on {date}.") uses Stripe's
 * upcoming-invoice total, with "Includes {carried} left from your last change." on a gray line under it.
 */
const T0 = Math.floor(new Date('2026-10-04T14:00:00Z').getTime() / 1000)
const START = T0 - 10 * 86_400
type Sub = Parameters<typeof changeAddon>[1]

function setup(creditCents: number) {
  const sim = createStripeSim({ nowSec: T0 })
  sim.addCustomer('cus_1', creditCents)
  sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', addons: [], tip: 4, periodStart: START })
  const addonDeps = { stripe: sim.client() as unknown as Stripe, addonPriceIdFor: async (id: AddonId) => SIM_PRICE_ID.addon(id), now: sim.now, log: () => {} }
  const live = () => sim.sub('sub_1') as unknown as Sub
  const tipDeps = (stripe: Stripe = sim.client() as unknown as Stripe) => ({ stripe, tipPriceId: async () => SIM_PRICE_ID.tip })
  return { sim, addonDeps, live, tipDeps }
}
/** The sim's client, counting the upcoming-invoice previews, optionally answering them with a fixed invoice. */
function previews(sim: ReturnType<typeof createStripeSim>, answer?: { amount_due: number; starting_balance: number }) {
  const c = sim.client()
  const calls: unknown[] = []
  const client = {
    ...c,
    invoices: {
      ...c.invoices,
      createPreview: async (p: Parameters<typeof c.invoices.createPreview>[0]) => {
        calls.push(p)
        return answer ? { object: 'invoice', total: answer.amount_due - answer.starting_balance, currency: 'usd', ...answer } : c.invoices.createPreview(p)
      },
    },
  } as unknown as Stripe
  return { client, calls }
}
const PRICE = 5500 + 575 // Priority + Big change

describe('carried small amount pending (Big change on with $5.40 credit: $0.35 owed)', () => {
  it('the tip preview and the saved tip show the upcoming-invoice total and the carried part', async () => {
    const { sim, addonDeps, live, tipDeps } = setup(540)
    expect(await changeAddon(addonDeps, live(), 'big_change', 'on', {})).toMatchObject({ ok: true, deferredCents: 35 })
    expect(await carriedPendingCents(sim.client() as unknown as Stripe, 'cus_1')).toBe(35)
    expect(await previewTipChange(tipDeps(), live(), 6)).toMatchObject({ ok: true, nextAmountCents: PRICE + 600 + 35, carriedCents: 35 })
    expect(await previewTipChange(tipDeps(), live(), 4)).toMatchObject({ ok: true, unchanged: true, nextAmountCents: PRICE + 400 + 35, carriedCents: 35 })
    expect(await changeTip(tipDeps(), live(), 6)).toMatchObject({ ok: true, kind: 'changed', nextAmountCents: PRICE + 600 + 35, carriedCents: 35 })
    // and the renewal really bills that total
    sim.advance(21 * 86_400)
    const renewal = sim.invoices().find((i) => i.billing_reason === 'subscription_cycle')!
    expect(renewal.amount_due).toBe(PRICE + 600 + 35)
    expect(renewalCarriedLine(35)).toBe('Includes $0.35 left from your last change.')
  })

  it('the total is Stripe\'s preview, never price + carried added up here', async () => {
    const { sim, addonDeps, live, tipDeps } = setup(540)
    await changeAddon(addonDeps, live(), 'big_change', 'on', {})
    const { client, calls } = previews(sim, { amount_due: 7777, starting_balance: 35 })
    expect(await previewTipChange(tipDeps(client), live(), 6)).toMatchObject({ nextAmountCents: 7777, carriedCents: 35 })
    expect(await previewTipChange(tipDeps(client), live(), 4)).toMatchObject({ unchanged: true, nextAmountCents: 7777, carriedCents: 35 })
    expect(await changeTip(tipDeps(client), live(), 6)).toMatchObject({ nextAmountCents: 7777, carriedCents: 35 })
    expect(calls).toEqual([
      expect.objectContaining({ subscription: 'sub_1', subscription_details: expect.objectContaining({ proration_behavior: 'none' }) }),
      { subscription: 'sub_1' },
      { subscription: 'sub_1' },
    ])
    expect(await upcomingBill(client, 'sub_1')).toEqual({ totalCents: 7777, carriedCents: 35 })
  })

  it('the upcoming preview fails: the existing line (no gray line), never a guess', async () => {
    const { sim, addonDeps, live, tipDeps } = setup(540)
    await changeAddon(addonDeps, live(), 'big_change', 'on', {})
    const c = sim.client()
    const broken = { ...c, invoices: { ...c.invoices, createPreview: () => Promise.reject(new Error('stripe 500 (simulated)')) } } as unknown as Stripe
    const r = await changeTip(tipDeps(broken), live(), 6)
    expect(r).toMatchObject({ ok: true, nextAmountCents: PRICE + 600 })
    expect(r).not.toHaveProperty('carriedCents')
  })
})

describe('nothing carried: unchanged', () => {
  it('no debit on the account: the tip lines keep their amounts, no carried part, no extra Stripe calls', async () => {
    const { sim, live, tipDeps } = setup(0)
    const { client, calls } = previews(sim)
    expect(await previewTipChange(tipDeps(client), live(), 6)).toMatchObject({ nextAmountCents: 5500 + 600, carriedCents: 0 })
    expect(await previewTipChange(tipDeps(client), live(), 4)).toMatchObject({ unchanged: true, nextAmountCents: 5500 + 400, carriedCents: 0 })
    const r = await changeTip(tipDeps(client), live(), 6)
    expect(r).toMatchObject({ ok: true, nextAmountCents: 5500 + 600 })
    expect(r).not.toHaveProperty('carriedCents')
    expect(calls).toHaveLength(1) // only the changed-tip preview, as before
  })
})

describe('carried amount already billed (the next charge collected it): no breakdown', () => {
  it('Big change (35 carried), then +1 small edit charged $5.35: the balance is 0, so the plain lines', async () => {
    const { sim, addonDeps, live, tipDeps } = setup(540)
    await changeAddon(addonDeps, live(), 'big_change', 'on', {})
    await changeAddon(addonDeps, live(), 'small_edit', 'on', {})
    expect(await carriedPendingCents(sim.client() as unknown as Stripe, 'cus_1')).toBe(0)
    expect(await previewTipChange(tipDeps(), live(), 6)).toMatchObject({ nextAmountCents: PRICE + 500 + 600, carriedCents: 0 })
    const r = await changeTip(tipDeps(), live(), 6)
    expect(r).toMatchObject({ ok: true, nextAmountCents: PRICE + 500 + 600 })
    expect(r).not.toHaveProperty('carriedCents')
  })
})
