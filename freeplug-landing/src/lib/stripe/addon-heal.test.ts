// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import type { AddonId } from '@/lib/plans/ladder'
import { changeAddon, healAddonCharge, previewAddonChange } from './change-plan'
import { healAddonChargeFromWebhook } from './addon-heal-webhook'
import { createStripeSim, SIM_PRICE_ID, type StripeSim } from '../../../test/stripe-addon-sim'

/**
 * Aria, Oct 4 8:59 AM CT, ruling 2d: the add-on self-heal. Everything runs on the in-memory Stripe
 * stand-in with a SIMULATED clock (test/stripe-addon-sim.ts), never real Stripe: every test-mode event
 * on the box reaches the :3000 listener (team rule, Vera and Jace 9:03).
 */
const USER = '11111111-2222-4333-8444-555555555555'
const T0 = Math.floor(new Date('2026-10-04T14:00:00Z').getTime() / 1000)
const quiet = () => {}
type SubArg = Parameters<typeof changeAddon>[1]

function setup(o: { credit?: number; tip?: number; step?: 'starter' | 'priority' } = {}) {
  const sim = createStripeSim({ nowSec: T0 })
  sim.addCustomer('cus_1', o.credit ?? 0)
  sim.addSub({ id: 'sub_1', customer: 'cus_1', step: o.step ?? 'starter', tip: o.tip ?? 0, periodStart: T0 - 10 * 86_400 })
  return sim
}
const deps = (sim: StripeSim, stripe: unknown = sim.client()) => ({
  stripe: stripe as Stripe,
  addonPriceIdFor: async (id: AddonId) => SIM_PRICE_ID.addon(id),
  now: sim.now,
  log: quiet,
})
const addonItems = (sim: StripeSim, id: AddonId) => sim.sub('sub_1').items.data.filter((i) => i.price.id === SIM_PRICE_ID.addon(id))
const tipOf = (sim: StripeSim) => sim.sub('sub_1').items.data.find((i) => i.price.id === SIM_PRICE_ID.tip)?.quantity ?? 0
const updates = (sim: StripeSim) => sim.log.filter((c) => c === 'subscriptions.update').length

/**
 * The request turns the add-on on and its process dies right after the card is charged (invoices.pay):
 * no subscription update, no refund, and its change-plan lock is never released (60 s expiry).
 */
async function crashAfterPay(sim: StripeSim, addon: AddonId, opts: { tipDropTo?: number; crashAfter?: string } = {}) {
  await sim.lockStore.claim(USER, 60)
  // Credit covering all of it: Stripe marks the invoice paid at finalize (no pay call), so "paid" = after finalize.
  const crashing = sim.client({ crashAfter: opts.crashAfter ?? 'invoices.pay' })
  const r = await changeAddon(deps(sim, crashing), sim.sub('sub_1') as unknown as SubArg, addon, 'on', { userId: USER, prorationDate: T0, ...opts })
  const inv = sim.invoices().find((i) => i.metadata.freeplug_kind === 'addon_first_period')!
  return { r, inv }
}
const webhook = (sim: StripeSim, invId: string, o: { lock?: boolean; stripe?: unknown } = {}) =>
  healAddonChargeFromWebhook(
    { ...deps(sim, o.stripe), lockStore: o.lock === false ? null : sim.lockStore, lockWaitMs: 0 },
    { id: invId, metadata: sim.invoice(invId).metadata }
  )

describe('the add-on charge carries what the self-heal needs (metadata)', () => {
  it('add-on key, user id, idempotency key, price and the confirmed tip', async () => {
    const sim = setup({ tip: 19 })
    const { inv } = await crashAfterPay(sim, 'small_edit', { tipDropTo: 14 })
    expect(inv.metadata).toMatchObject({
      freeplug_kind: 'addon_first_period',
      addon: 'small_edit',
      subscription: 'sub_1',
      user_id: USER,
      price: SIM_PRICE_ID.addon('small_edit'),
      tip_before: '19',
      tip_after: '14',
    })
    expect(inv.metadata.idempotency_key).toMatch(new RegExp(`^addon-on:${USER}:small_edit:${T0}:14:sub_1:`))
  })
})

describe('crash between paying and adding: the invoice.paid self-heal finishes it (simulated clock)', () => {
  it('paid, no item, no refund after the crash; the webhook waits for the lock, then adds it once with the confirmed tip', async () => {
    const sim = setup({ tip: 19 })
    const { r, inv } = await crashAfterPay(sim, 'small_edit', { tipDropTo: 14 })
    expect(r).toMatchObject({ ok: false, code: 'finishing' }) // in a real crash nothing returns; the state is what matters
    expect(inv).toMatchObject({ status: 'paid', amount_paid: 500 })
    expect(addonItems(sim, 'small_edit')).toHaveLength(0)
    expect(sim.creditNotes).toHaveLength(0)
    expect(sim.events.filter((e) => e.data.object.id === inv.id)).toHaveLength(1)

    // first delivery a few seconds later: the crashed request still holds the lock -> retry (non-2xx), nothing written
    sim.advance(3)
    const before = updates(sim)
    expect(await webhook(sim, inv.id)).toEqual({ outcome: 'retry', reason: 'in_progress' })
    expect(updates(sim)).toBe(before)

    // Stripe redelivers after the lock expired (60 s): added, tip 19 -> 14 (confirmed), marked applied
    sim.advance(61)
    expect(await webhook(sim, inv.id)).toEqual({ outcome: 'applied', addon: 'small_edit' })
    expect(addonItems(sim, 'small_edit')).toHaveLength(1)
    expect(tipOf(sim)).toBe(14)
    expect(sim.invoice(inv.id).metadata.addon_applied).toBe(addonItems(sim, 'small_edit')[0].id)

    // replays (Stripe retries, a late duplicate) never add it twice and never refund
    const after = updates(sim)
    expect(await webhook(sim, inv.id)).toMatchObject({ outcome: 'already_applied' })
    expect(await webhook(sim, inv.id, { lock: false })).toMatchObject({ outcome: 'already_applied' })
    expect(updates(sim)).toBe(after)
    expect(sim.creditNotes).toHaveLength(0)

    // the renewal bills the add-on at its monthly price with the lower tip: $35 + $5 + $14 = $54
    sim.advance(25 * 86_400)
    const renewal = sim.invoices().find((i) => i.billing_reason === 'subscription_cycle')!
    expect(renewal.total).toBe(3500 + 500 + 1400)
    expect(renewal.lines.data.filter((l) => l.price?.id === SIM_PRICE_ID.addon('small_edit'))).toHaveLength(1)
    // and the first event replayed after the renewal changes nothing
    expect(await webhook(sim, inv.id)).toMatchObject({ outcome: 'already_applied' })
  })

  it('concurrent deliveries: one adds it, the other waits / sees it; exactly one item and one update', async () => {
    const sim = setup({ step: 'priority' })
    const { inv } = await crashAfterPay(sim, 'big_change')
    sim.advance(61)
    const before = updates(sim)
    const results = await Promise.all([webhook(sim, inv.id), webhook(sim, inv.id), webhook(sim, inv.id)])
    expect(results.filter((x) => x.outcome === 'applied')).toHaveLength(1)
    expect(results.every((x) => ['applied', 'already_applied', 'retry'].includes(x.outcome))).toBe(true)
    expect(addonItems(sim, 'big_change')).toHaveLength(1)
    expect(updates(sim) - before).toBe(1)
  })

  it('no user id on the charge (no lock): concurrent deliveries still add one item (Stripe idempotency key + fresh reads)', async () => {
    const sim = setup({ step: 'priority' })
    const { inv } = await crashAfterPay(sim, 'big_change')
    await sim.client().invoices.update(inv.id, { metadata: { user_id: '' } })
    const results = await Promise.all([webhook(sim, inv.id), webhook(sim, inv.id)])
    expect(results.map((x) => x.outcome)).toContain('applied')
    expect(results.every((x) => x.outcome === 'applied' || x.outcome === 'already_applied')).toBe(true)
    expect(addonItems(sim, 'big_change')).toHaveLength(1)
  })

  it('a transient Stripe error while adding: retry (no refund), then added on the next delivery', async () => {
    const sim = setup({ step: 'priority' })
    const { inv } = await crashAfterPay(sim, 'small_edit')
    sim.advance(61)
    const flaky = sim.client()
    const real = flaky.subscriptions.update
    let fails = 1
    flaky.subscriptions.update = ((...a: Parameters<typeof real>) =>
      fails-- > 0 ? Promise.reject(Object.assign(new Error('Stripe 500'), { type: 'StripeAPIError', statusCode: 500 })) : real(...a)) as typeof real
    expect(await webhook(sim, inv.id, { stripe: flaky })).toMatchObject({ outcome: 'retry' })
    expect(sim.creditNotes).toHaveLength(0)
    expect(await webhook(sim, inv.id, { stripe: flaky })).toMatchObject({ outcome: 'applied' })
    expect(addonItems(sim, 'small_edit')).toHaveLength(1)
  })
})

describe('the webhook waits for the Plans page request that holds the lock', () => {
  it('lock held while the request finishes normally: waits, then sees it applied (no second item)', async () => {
    const sim = setup({ step: 'priority' })
    // the request is mid-way: charged and added, but still holds the lock when invoice.paid lands
    const claim = (await sim.lockStore.claim(USER, 60))!
    await changeAddon(deps(sim), sim.sub('sub_1') as unknown as SubArg, 'small_edit', 'on', { userId: USER, prorationDate: T0 })
    const inv = sim.invoices().find((i) => i.metadata.freeplug_kind === 'addon_first_period')!
    await sim.client().invoices.update(inv.id, { metadata: { addon_applied: '' } }) // pretend the marker isn't written yet
    let waits = 0
    const r = await healAddonChargeFromWebhook(
      { ...deps(sim), lockStore: sim.lockStore, lockWaitMs: 5_000, sleep: async () => void (waits++ === 1 && (await sim.lockStore.release(USER, claim))) },
      { id: inv.id, metadata: inv.metadata }
    )
    expect(waits).toBeGreaterThanOrEqual(2)
    expect(r).toMatchObject({ outcome: 'already_applied' })
    expect(addonItems(sim, 'small_edit')).toHaveLength(1)
  })
  it('the lock table is unreachable: retry (fails closed, nothing written)', async () => {
    const sim = setup({ step: 'priority' })
    const { inv } = await crashAfterPay(sim, 'small_edit')
    const before = updates(sim)
    const broken = { claim: async () => Promise.reject(new Error('db down')), release: async () => undefined }
    expect(await healAddonChargeFromWebhook({ ...deps(sim), lockStore: broken, lockWaitMs: 0 }, { id: inv.id, metadata: inv.metadata })).toEqual({ outcome: 'retry', reason: 'lock_error' })
    expect(updates(sim)).toBe(before)
  })
})

describe("can't be added: refunded automatically, once, and logged", () => {
  it.each([
    ['the subscription was canceled', (sim: StripeSim) => sim.cancel('sub_1')],
    ['the add-on price is gone (archived)', (sim: StripeSim) => sim.archivePrice(SIM_PRICE_ID.addon('small_edit'))],
  ])('%s', async (_why, breakIt) => {
    const sim = setup({ step: 'priority' })
    const { inv } = await crashAfterPay(sim, 'small_edit')
    breakIt(sim)
    sim.advance(61)
    const logs: string[] = []
    const r = await healAddonChargeFromWebhook({ ...deps(sim), log: (m) => logs.push(m), lockStore: sim.lockStore, lockWaitMs: 0 }, { id: inv.id, metadata: inv.metadata })
    expect(r).toMatchObject({ outcome: 'refunded', addon: 'small_edit' })
    expect(sim.creditNotes).toEqual([expect.objectContaining({ invoice: inv.id, amount: 500, refund_amount: 500, credit_amount: 0 })])
    expect(sim.invoice(inv.id).metadata.addon_refunded).toBe('true')
    expect(logs.some((l) => l.includes(inv.id) && l.includes('refunding'))).toBe(true)
    expect(logs.some((l) => l.startsWith(`[change-addon] REFUNDED ${inv.id}`))).toBe(true)
    // replays and a second delivery: no second credit note
    expect(await webhook(sim, inv.id)).toMatchObject({ outcome: 'already_refunded' })
    await sim.client().invoices.update(inv.id, { metadata: { addon_refunded: '' } }) // marker lost: the credited total still says done
    expect(await webhook(sim, inv.id)).toMatchObject({ outcome: 'already_refunded' })
    expect(sim.creditNotes).toHaveLength(1)
    expect(addonItems(sim, 'small_edit')).toHaveLength(0)
  })

  it('the period it paid for is over (first delivered after the renewal): refunded, never added late', async () => {
    const sim = setup({ step: 'priority' })
    const { inv } = await crashAfterPay(sim, 'big_change')
    sim.advance(21 * 86_400) // renews without the add-on
    expect(await webhook(sim, inv.id)).toMatchObject({ outcome: 'refunded' })
    expect(addonItems(sim, 'big_change')).toHaveLength(0)
  })

  it('a tip drop the customer did not confirm: refunded (a tip is never lowered silently)', async () => {
    const sim = setup({ tip: 19 })
    const { inv } = await crashAfterPay(sim, 'small_edit', { tipDropTo: 14 })
    await sim.client().invoices.update(inv.id, { metadata: { tip_after: '19' } })
    sim.advance(61)
    expect(await webhook(sim, inv.id)).toMatchObject({ outcome: 'refunded' })
    expect(tipOf(sim)).toBe(19)
  })

  it('the refund itself fails: refund_failed (the route answers non-2xx), then refunded once on the next delivery', async () => {
    const sim = setup({ step: 'priority' })
    const { inv } = await crashAfterPay(sim, 'small_edit')
    sim.cancel('sub_1')
    sim.advance(61)
    const flaky = sim.client()
    const real = flaky.creditNotes.create
    let fails = 1
    flaky.creditNotes.create = ((...a: Parameters<typeof real>) =>
      fails-- > 0 ? Promise.reject(Object.assign(new Error('Stripe 500'), { type: 'StripeAPIError' })) : real(...a)) as typeof real
    expect(await webhook(sim, inv.id, { stripe: flaky })).toMatchObject({ outcome: 'refund_failed' })
    expect(await webhook(sim, inv.id, { stripe: flaky })).toMatchObject({ outcome: 'refunded' })
    expect(sim.creditNotes).toHaveLength(1)
  })

  it('other invoices (a renewal) are not touched', async () => {
    const sim = setup({ step: 'priority' })
    sim.advance(21 * 86_400)
    const renewal = sim.invoices().find((i) => i.billing_reason === 'subscription_cycle')!
    const before = sim.log.length
    expect(await webhook(sim, renewal.id)).toEqual({ outcome: 'not_addon' })
    expect(sim.log.length).toBe(before)
  })
})

describe('Aria 8:59, ruling 2b: the confirm shows the REAL amount (Stripe preview, account credit applied)', () => {
  it.each([
    ['no credit', 0, 575],
    ['credit covers part of it', 200, 375],
    ['credit covers all of it', 1000, 0],
  ])('%s: amount due %i -> %i', async (_why, credit, due) => {
    const sim = setup({ step: 'priority', credit })
    const p = await previewAddonChange(deps(sim), sim.sub('sub_1') as unknown as SubArg, 'big_change', 'on', T0)
    expect(p).toMatchObject({ ok: true, action: 'on', amountDueCents: due, fullCents: 575 })
    // the real charge matches the preview
    const r = await changeAddon(deps(sim), sim.sub('sub_1') as unknown as SubArg, 'big_change', 'on', { userId: USER, prorationDate: T0 })
    expect(r).toMatchObject({ ok: true, kind: 'on' })
    const inv = sim.invoices().find((i) => i.metadata.freeplug_kind === 'addon_first_period')!
    expect(inv).toMatchObject({ status: 'paid', total: 575, amount_paid: due })
    expect(inv.metadata.addon_applied).toBeTruthy()
  })

  it.each([
    ['no credit', 0, { refund_amount: 575, credit_amount: 0 }],
    ['part credit', 200, { refund_amount: 375, credit_amount: 200 }],
    ['all credit', 1000, { refund_amount: 0, credit_amount: 575 }],
  ])('a refund after %s goes back the way it was paid (card part refunded, credit part credited)', async (_why, credit, split) => {
    const sim = setup({ step: 'priority', credit })
    const { inv } = await crashAfterPay(sim, 'big_change', credit >= 575 ? { crashAfter: 'invoices.finalize' } : {})
    expect(sim.invoice(inv.id)).toMatchObject({ status: 'paid', amount_paid: 575 - Math.min(credit, 575) })
    sim.cancel('sub_1')
    sim.advance(61)
    expect(await webhook(sim, inv.id)).toMatchObject({ outcome: 'refunded' })
    expect(sim.creditNotes).toEqual([expect.objectContaining({ amount: 575, ...split })])
    expect(sim.customer('cus_1').balance + credit).toBe(0) // the credit used is back on the account
  })
})

describe('direct healAddonCharge (the request path uses it inline under its own lock)', () => {
  it('runs without the lock and is idempotent', async () => {
    const sim = setup({ step: 'priority' })
    const { inv } = await crashAfterPay(sim, 'small_edit')
    expect(await healAddonCharge(deps(sim), inv.id)).toMatchObject({ outcome: 'applied' })
    expect(await healAddonCharge(deps(sim), inv.id)).toMatchObject({ outcome: 'already_applied' })
    expect(addonItems(sim, 'small_edit')).toHaveLength(1)
  })
})
