// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { PLAN_STEPS, type AddonId, type PlanStepId } from '@/lib/plans/ladder'
import {
  changeAddon,
  changePlanStep,
  changeTip,
  currentLadderStep,
  pendingPlanChange,
  previewAddonChange,
  previewPlanStepChange,
  subscriptionMonthlyCents,
  upgradeItems,
} from './change-plan'

const step = (id: PlanStepId) => PLAN_STEPS.find((s) => s.id === id)!
const NOW = new Date('2026-10-04T13:00:00Z')
const NOW_S = Math.floor(NOW.getTime() / 1000)
const PERIOD_START = NOW_S - 3 * 86_400
const PERIOD_END = NOW_S + 27 * 86_400

const stepPrice = (id: PlanStepId) => ({ id: `price_${id}`, lookup_key: step(id).lookupKey, product: step(id).productId, unit_amount: step(id).monthlyCents, recurring: { interval: 'month' } })
const ADDON_PRICE: Record<AddonId, { id: string; lookup_key: string; product: string; unit_amount: number; recurring: { interval: string } }> = {
  small_edit: { id: 'price_small', lookup_key: 'freeplug_addon_small_edit_monthly', product: 'freeplug_extra_small_edit', unit_amount: 500, recurring: { interval: 'month' } },
  big_change: { id: 'price_big', lookup_key: 'freeplug_addon_big_change_monthly', product: 'freeplug_extra_big_change', unit_amount: 575, recurring: { interval: 'month' } },
}
const TIP_PRICE = { id: 'price_tip', lookup_key: 'freeplug_tip_monthly', product: 'freeplug_tip', unit_amount: 100, recurring: { interval: 'month' } }
const PRICES: Record<string, unknown> = {
  ...Object.fromEntries(PLAN_STEPS.map((s) => [`price_${s.id}`, stepPrice(s.id)])),
  price_small: ADDON_PRICE.small_edit,
  price_big: ADDON_PRICE.big_change,
  price_tip: TIP_PRICE,
}

function sub(
  stepId: PlanStepId,
  opts: { addons?: AddonId[]; tip?: number; schedule?: string | null; addonAmount?: Partial<Record<AddonId, number>>; periodEnd?: number } = {}
) {
  const end = opts.periodEnd ?? PERIOD_END
  const items: unknown[] = [{ id: 'si_step', quantity: 1, price: stepPrice(stepId), current_period_start: PERIOD_START, current_period_end: end }]
  for (const a of opts.addons ?? []) {
    items.push({ id: `si_${a}`, quantity: 1, price: { ...ADDON_PRICE[a], unit_amount: opts.addonAmount?.[a] ?? ADDON_PRICE[a].unit_amount }, current_period_start: PERIOD_START, current_period_end: end })
  }
  if (opts.tip) items.push({ id: 'si_tip', quantity: opts.tip, price: TIP_PRICE, current_period_start: PERIOD_START, current_period_end: end })
  return {
    id: 'sub_1',
    customer: 'cus_1',
    default_payment_method: 'pm_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    schedule: opts.schedule ?? null,
    latest_invoice: 'in_0',
    items: { data: items },
  } as unknown as Stripe.Subscription
}

type Phase = { items: { price: string; quantity: number }[]; metadata?: Record<string, string> }

/** Fake Stripe: one optional schedule whose next phase is `next`; `after` = what retrieve returns after an update. */
type ChargeOpts = {
  /** invoices.pay throws a card error. */
  payDeclined?: boolean
  /** invoices.pay returns this status (e.g. 'open' when the bank wants 3D Secure). */
  payStatus?: string
  /** finalizeInvoice returns this total (e.g. a tax line slipped in). */
  finalTotal?: number
  /** invoices.create returns an invoice already in this status (a replayed key). */
  replayStatus?: string
  /** subscriptions.update throws after the charge. */
  updateFails?: boolean
}
function fake(opts: { next?: Phase | null; after?: Stripe.Subscription; cardError?: boolean; amountDue?: number } & ChargeOpts = {}) {
  let itemCents = 0
  const calls: string[] = []
  const schedule = {
    id: 'sub_sched_0',
    status: 'active',
    current_phase: { start_date: PERIOD_START, end_date: PERIOD_END },
    phases: [
      { start_date: PERIOD_START, end_date: PERIOD_END, items: [{ price: 'price_x', quantity: 1 }], metadata: {} },
      ...(opts.next ? [{ start_date: PERIOD_END, end_date: PERIOD_END + 30 * 86_400, ...opts.next, metadata: opts.next.metadata ?? {} }] : []),
    ],
  }
  const raw = {
    subscriptions: {
      update: vi.fn(async (id: string) => {
        calls.push('subscriptions.update')
        if (opts.cardError) throw Object.assign(new Error('declined'), { type: 'StripeCardError', code: 'card_declined' })
        if (opts.updateFails) throw Object.assign(new Error('boom'), { type: 'StripeAPIError' })
        return { ...(opts.after ?? {}), id, pending_update: null, latest_invoice: { id: 'in_new', status: 'paid' } }
      }),
      retrieve: vi.fn(async () => (calls.push('subscriptions.retrieve'), opts.after)),
    },
    invoices: {
      createPreview: vi.fn(async () => (calls.push('invoices.createPreview'), { amount_due: opts.amountDue ?? 451, currency: 'usd' })),
      voidInvoice: vi.fn(async () => (calls.push('invoices.void'), {})),
      del: vi.fn(async () => (calls.push('invoices.del'), {})),
      create: vi.fn(async () => (calls.push('invoices.create'), { id: 'in_addon', status: opts.replayStatus ?? 'draft', total: 0, amount_paid: opts.replayStatus === 'paid' ? 575 : 0 })),
      finalizeInvoice: vi.fn(async () => (calls.push('invoices.finalize'), { id: 'in_addon', status: 'open', total: opts.finalTotal ?? itemCents })),
      pay: vi.fn(async () => {
        calls.push('invoices.pay')
        if (opts.payDeclined) throw Object.assign(new Error('declined'), { type: 'StripeCardError', code: 'card_declined' })
        return { id: 'in_addon', status: opts.payStatus ?? 'paid', total: itemCents, amount_paid: opts.payStatus && opts.payStatus !== 'paid' ? 0 : itemCents }
      }),
    },
    invoiceItems: {
      create: vi.fn(async (p: { amount: number }) => {
        calls.push('invoiceItems.create')
        itemCents = p.amount
        return { id: 'ii_1' }
      }),
    },
    creditNotes: { create: vi.fn(async () => (calls.push('creditNotes.create'), { id: 'cn_1' })) },
    prices: { retrieve: vi.fn(async (id: string) => (calls.push(`prices.retrieve:${id}`), PRICES[id])) },
    subscriptionSchedules: {
      create: vi.fn(async () => (calls.push('schedules.create'), { id: 'sub_sched_new', status: 'active', current_phase: { start_date: PERIOD_START, end_date: PERIOD_END }, phases: [{ start_date: PERIOD_START, end_date: PERIOD_END, items: [] }] })),
      retrieve: vi.fn(async () => (calls.push('schedules.retrieve'), schedule)),
      update: vi.fn(async () => (calls.push('schedules.update'), {})),
      release: vi.fn(async () => (calls.push('schedules.release'), {})),
    },
  }
  return { stripe: raw as unknown as Stripe, raw, calls }
}
const priceIdFor = async (id: PlanStepId) => `price_${id}`
const addonPriceIdFor = async (id: AddonId) => ADDON_PRICE[id].id
const deps = (f: ReturnType<typeof fake>) => ({ stripe: f.stripe, addonPriceIdFor, now: () => NOW, log: () => {} })
const phase2 = (f: ReturnType<typeof fake>) => (f.raw.subscriptionSchedules.update.mock.calls[0] as unknown as [string, { phases: { items: unknown; metadata?: unknown; end_date?: number }[] }])[1].phases

describe('the step is read from the plan item only', () => {
  it('add-ons and the tip never change the step or the plan price', () => {
    const s = sub('starter', { addons: ['small_edit', 'big_change'], tip: 8 })
    expect(currentLadderStep(s)?.id).toBe('starter')
    expect(subscriptionMonthlyCents(s)).toBe(3500)
  })
})

describe('upgrade keeps add-ons (only the tip and grandfathered extras go)', () => {
  it('upgradeItems: step item -> new price, add-on items untouched, tip deleted', () => {
    expect(upgradeItems(sub('starter', { addons: ['small_edit', 'big_change'], tip: 4 }), 'price_fast_lane')).toEqual([
      { id: 'si_step', price: 'price_fast_lane', quantity: 1 },
      { id: 'si_tip', deleted: true },
    ])
  })
  it('the upgrade preview lists the add-ons that stay on and counts them in the next bill', async () => {
    const f = fake()
    const p = await previewPlanStepChange({ stripe: f.stripe, priceIdFor }, sub('starter', { addons: ['big_change'], tip: 4 }), 'priority', NOW_S)
    expect(p).toMatchObject({ ok: true, addons: ['big_change'], addonCents: 575, nextAmountCents: 5500 + 575, tipDollars: 4 })
  })
})

describe('downgrade: every schedule phase carries the add-ons; the tip resets to 0', () => {
  it('phase 1 = live items (add-ons + tip), phase 2 = new step + the same add-ons, no tip', async () => {
    const f = fake()
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, sub('fast_lane', { addons: ['small_edit', 'big_change'], tip: 9 }), 'starter')
    expect(r).toMatchObject({ ok: true, kind: 'scheduled', step: 'starter' })
    const [p1, p2] = phase2(f)
    expect(p1.items).toEqual([
      { price: 'price_fast_lane', quantity: 1 },
      { price: 'price_small', quantity: 1 },
      { price: 'price_big', quantity: 1 },
      { price: 'price_tip', quantity: 9 },
    ])
    expect(p1.end_date).toBe(PERIOD_END)
    expect(p2.items).toEqual([
      { price: 'price_starter', quantity: 1 },
      { price: 'price_small', quantity: 1 },
      { price: 'price_big', quantity: 1 },
    ])
    expect(p2.metadata).toEqual({ plan_step: 'starter', addons: 'small_edit,big_change', tip_dollars: '0', kind: 'switch' })
  })
  it('downgrade to Starter with both add-ons ($35 + $10.75) fits: nothing ends', async () => {
    const f = fake()
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, sub('priority', { addons: ['small_edit', 'big_change'] }), 'starter')).toMatchObject({ ok: true, kind: 'scheduled' })
  })
  it('if Starter ever could not fit the add-ons: refused with "Turn off an add-on first", nothing written', async () => {
    const f = fake()
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, sub('priority', { addons: ['small_edit', 'big_change'], addonAmount: { small_edit: 1000 } }), 'starter')
    expect(r).toEqual({ ok: false, code: 'addons_over_cap', message: 'Turn off an add-on first' })
    expect(f.calls).toEqual([])
  })
  it('a downgrade made while an add-on removal is pending keeps the removal', async () => {
    const f = fake({ next: { items: [{ price: 'price_priority', quantity: 1 }, { price: 'price_big', quantity: 1 }, { price: 'price_tip', quantity: 3 }], metadata: { plan_step: 'priority', addons: 'big_change', tip_dollars: '3', kind: 'addons' } } })
    await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, sub('priority', { addons: ['small_edit', 'big_change'], tip: 3, schedule: 'sub_sched_0' }), 'starter')
    expect(phase2(f)[1].items).toEqual([{ price: 'price_starter', quantity: 1 }, { price: 'price_big', quantity: 1 }])
  })
})

describe('pendingFromSchedule with several items (change-plan.ts used to need exactly one)', () => {
  it('no metadata: resolves every price and splits step / add-ons / tip', async () => {
    const f = fake({ next: { items: [{ price: 'price_starter', quantity: 1 }, { price: 'price_small', quantity: 1 }, { price: 'price_tip', quantity: 2 }] } })
    const p = await pendingPlanChange(f.stripe, sub('priority', { addons: ['small_edit', 'big_change'], schedule: 'sub_sched_0' }), NOW)
    expect(p).toMatchObject({ step: 'starter', addons: ['small_edit'], tipDollars: 2, isSwitch: true, removedAddons: ['big_change'] })
  })
  it('an add-on-only phase reads as "ends on <date>", not a plan switch', async () => {
    const f = fake({ next: { items: [{ price: 'price_priority', quantity: 1 }], metadata: { plan_step: 'priority', addons: '', tip_dollars: '0', kind: 'addons' } } })
    const p = await pendingPlanChange(f.stripe, sub('priority', { addons: ['big_change'], schedule: 'sub_sched_0' }), NOW)
    expect(p).toMatchObject({ step: 'priority', isSwitch: false, removedAddons: ['big_change'], effectiveAt: new Date(PERIOD_END * 1000).toISOString() })
    expect(f.calls).not.toContain('prices.retrieve:price_priority') // metadata answered
  })
})

describe('turning an add-on ON: charged now, once each, never a silent tip drop', () => {
  it('Priority + Big change: full price paid first, then the item with proration none, verified on the live subscription', async () => {
    const after = sub('priority', { addons: ['big_change'] })
    const f = fake({ after })
    const r = await changeAddon(deps(f), sub('priority'), 'big_change', 'on', { prorationDate: NOW_S - 10, userId: 'u1' })
    expect(r).toEqual({ ok: true, kind: 'on', addon: 'big_change', tipDollars: 0, invoiceStatus: 'paid', invoiceId: 'in_addon' })
    expect(f.calls).toEqual(['invoices.create', 'invoiceItems.create', 'invoices.finalize', 'invoices.pay', 'subscriptions.update', 'subscriptions.retrieve'])
    const [, params, o] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams, { idempotencyKey: string }]
    expect(params).toEqual({ items: [{ price: 'price_big', quantity: 1 }], proration_behavior: 'none' })
    expect(o.idempotencyKey).toMatch(/^addon-on:u1:big_change:.*:sub$/)
  })
  it('each add-on at most once', async () => {
    const f = fake()
    expect(await changeAddon(deps(f), sub('fast_lane', { addons: ['small_edit'] }), 'small_edit', 'on')).toMatchObject({ ok: false, code: 'already_on' })
    expect(f.calls).toEqual([])
  })
  it('Starter at a $19 tip: refused until the customer confirms the drop to $14, then both change in one update', async () => {
    const f = fake({ after: sub('starter', { addons: ['small_edit'], tip: 14 }) })
    const before = sub('starter', { tip: 19 })
    expect(await changeAddon(deps(f), before, 'small_edit', 'on')).toMatchObject({ ok: false, code: 'tip_drop_needed', tipDollars: 14 })
    expect(await changeAddon(deps(f), before, 'small_edit', 'on', { tipDropTo: 15 })).toMatchObject({ ok: false, code: 'tip_drop_needed', tipDollars: 14 })
    expect(f.calls).toEqual([])
    expect(await changeAddon(deps(f), before, 'small_edit', 'on', { tipDropTo: 14 })).toMatchObject({ ok: true, kind: 'on', tipDollars: 14 })
    const [, params] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams]
    expect(params.items).toEqual([{ price: 'price_small', quantity: 1 }, { id: 'si_tip', quantity: 14 }])
  })
  it('Starter with both on: tip max $8 (a $13 tip drops to $8 when Big change is added to +1 small edit)', async () => {
    const f = fake()
    const p = await previewAddonChange(deps(f), sub('starter', { addons: ['small_edit'], tip: 13 }), 'big_change', 'on', NOW_S)
    expect(p).toMatchObject({ ok: true, action: 'on', tipDollarsNow: 13, tipDollarsAfter: 8, nextAmountCents: 3500 + 1075 + 800, amountDueCents: 575 })
  })
  it('a tip that already fits is left alone', async () => {
    const f = fake()
    const p = await previewAddonChange(deps(f), sub('starter', { tip: 8 }), 'big_change', 'on', NOW_S)
    expect(p).toMatchObject({ ok: true, tipDollarsNow: 8, tipDollarsAfter: 8 })
  })
  it('Starter add-on cap ($15) from live Stripe amounts: refused with "Turn off an add-on first"', async () => {
    const f = fake()
    const r = await changeAddon(deps(f), sub('starter', { addons: ['small_edit'], addonAmount: { small_edit: 1000 } }), 'big_change', 'on')
    expect(r).toEqual({ ok: false, code: 'over_cap', message: 'Turn off an add-on first' })
  })
  it('Stripe answered but the live subscription lacks the add-on: never "on", and the charge is refunded', async () => {
    const f = fake({ after: sub('priority') })
    expect(await changeAddon(deps(f), sub('priority'), 'small_edit', 'on')).toEqual({ ok: false, code: 'not_applied', message: 'Stripe did not add the add-on.', refunded: true })
    expect(f.raw.creditNotes.create).toHaveBeenCalledWith(
      { invoice: 'in_addon', amount: 500, refund_amount: 500, reason: 'order_change', memo: 'Add-on could not be turned on; refunded.' },
      { idempotencyKey: 'addon-refund:in_addon' }
    )
  })
  it('grandfathered plans get no add-ons', async () => {
    const legacy = { ...sub('starter'), items: { data: [{ id: 'si_h', quantity: 1, price: { id: 'p_h', lookup_key: null, product: 'prod_h', unit_amount: 4000, recurring: { interval: 'month' } } }] } } as unknown as Stripe.Subscription
    expect(await changeAddon(deps(fake()), legacy, 'small_edit', 'on')).toMatchObject({ ok: false, code: 'no_addon_plan' })
  })
})

/** What the next renewal bills: every recurring item at its monthly price (proration none = nothing else carried over). */
const renewalCents = (s: Stripe.Subscription) => s.items.data.reduce((n, i) => n + (i.price.unit_amount ?? 0) * (i.quantity ?? 1), 0)

describe('Aria, Oct 4 8:28 AM: turning on charges the FULL price now, never a partial month', () => {
  const twoDaysLeft = NOW_S + 2 * 86_400
  it.each([
    ['small_edit', 500],
    ['big_change', 575],
  ] as const)('%s turned on with 2 days left: exactly %i cents now as its own invoice; the next renewal is the normal monthly amount', async (id, cents) => {
    const after = sub('priority', { addons: [id], periodEnd: twoDaysLeft })
    const f = fake({ after })
    const r = await changeAddon(deps(f), sub('priority', { periodEnd: twoDaysLeft }), id, 'on', { prorationDate: NOW_S })
    expect(r).toMatchObject({ ok: true, kind: 'on', addon: id })
    // the one-off invoice: only this charge (pending items excluded), the plan's card, no subscription link
    const [invParams] = f.raw.invoices.create.mock.calls[0] as unknown as [Record<string, unknown>]
    expect(invParams).toMatchObject({ customer: 'cus_1', pending_invoice_items_behavior: 'exclude', collection_method: 'charge_automatically', auto_advance: false, default_payment_method: 'pm_1', currency: 'usd' })
    expect(invParams).toMatchObject({ metadata: { freeplug_kind: 'addon_first_period', addon: id, subscription: 'sub_1' } })
    expect(invParams).not.toHaveProperty('subscription')
    const [itemParams] = f.raw.invoiceItems.create.mock.calls[0] as unknown as [Record<string, unknown>]
    expect(itemParams).toMatchObject({ customer: 'cus_1', invoice: 'in_addon', amount: cents, currency: 'usd' })
    expect(f.raw.invoices.pay).toHaveBeenCalledWith('in_addon', { off_session: true }, expect.anything())
    // no proration anywhere: the subscription change itself bills nothing now
    const [, params] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams]
    expect(params.proration_behavior).toBe('none')
    expect(params).not.toHaveProperty('proration_date')
    expect(f.raw.invoices.createPreview).not.toHaveBeenCalled()
    expect(renewalCents(after)).toBe(5500 + cents)
  })
  it('the confirm amount is the full price on any day (no Stripe proration preview)', async () => {
    const f = fake()
    const late = await previewAddonChange(deps(f), sub('priority', { periodEnd: twoDaysLeft }), 'big_change', 'on', NOW_S)
    const early = await previewAddonChange(deps(f), sub('priority'), 'small_edit', 'on', NOW_S)
    expect(late).toMatchObject({ ok: true, action: 'on', amountDueCents: 575, nextAmountCents: 5500 + 575 })
    expect(early).toMatchObject({ ok: true, action: 'on', amountDueCents: 500, nextAmountCents: 5500 + 500 })
    expect(f.raw.invoices.createPreview).not.toHaveBeenCalled()
  })
  it('a declined card: the invoice is voided and the add-on stays off (the subscription is never touched)', async () => {
    const f = fake({ payDeclined: true })
    expect(await changeAddon(deps(f), sub('priority'), 'small_edit', 'on')).toMatchObject({ ok: false, code: 'payment_failed' })
    expect(f.calls).toEqual(['invoices.create', 'invoiceItems.create', 'invoices.finalize', 'invoices.pay', 'invoices.void'])
    expect(f.raw.subscriptions.update).not.toHaveBeenCalled()
  })
  it('a charge left unpaid (bank wants 3D Secure): voided, add-on stays off', async () => {
    const f = fake({ payStatus: 'open' })
    expect(await changeAddon(deps(f), sub('priority'), 'big_change', 'on')).toMatchObject({ ok: false, code: 'payment_failed' })
    expect(f.calls.slice(-1)).toEqual(['invoices.void'])
    expect(f.raw.subscriptions.update).not.toHaveBeenCalled()
  })
  it('an invoice whose total is not exactly the add-on price is voided before any charge', async () => {
    const f = fake({ finalTotal: 621 })
    expect(await changeAddon(deps(f), sub('priority'), 'big_change', 'on')).toMatchObject({ ok: false, code: 'price' })
    expect(f.raw.invoices.pay).not.toHaveBeenCalled()
    expect(f.raw.subscriptions.update).not.toHaveBeenCalled()
  })
  it('charged but the subscription update fails: refunded with a credit note, never left charged-and-off silently', async () => {
    const f = fake({ updateFails: true })
    expect(await changeAddon(deps(f), sub('priority'), 'big_change', 'on')).toMatchObject({ ok: false, code: 'not_applied', refunded: true })
    expect(f.raw.creditNotes.create).toHaveBeenCalledWith(expect.objectContaining({ invoice: 'in_addon', amount: 575, refund_amount: 575 }), expect.anything())
  })
  it('a replayed key whose invoice is already paid does not charge again; a voided one asks for a new preview', async () => {
    const paid = fake({ replayStatus: 'paid', after: sub('priority', { addons: ['big_change'] }) })
    expect(await changeAddon(deps(paid), sub('priority'), 'big_change', 'on')).toMatchObject({ ok: true, kind: 'on' })
    expect(paid.raw.invoiceItems.create).not.toHaveBeenCalled()
    expect(paid.raw.invoices.pay).not.toHaveBeenCalled()
    const voided = fake({ replayStatus: 'void' })
    expect(await changeAddon(deps(voided), sub('priority'), 'big_change', 'on')).toMatchObject({ ok: false, code: 'stale_preview' })
    expect(voided.raw.subscriptions.update).not.toHaveBeenCalled()
  })
  it('the Starter tip drop rides on the same no-proration update (applies from the next renewal)', async () => {
    const after = sub('starter', { addons: ['small_edit'], tip: 14 })
    const f = fake({ after })
    expect(await changeAddon(deps(f), sub('starter', { tip: 19 }), 'small_edit', 'on', { tipDropTo: 14 })).toMatchObject({ ok: true, tipDollars: 14 })
    const [, params] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams]
    expect(params).toEqual({ items: [{ price: 'price_small', quantity: 1 }, { id: 'si_tip', quantity: 14 }], proration_behavior: 'none' })
    expect(renewalCents(after)).toBe(3500 + 500 + 1400) // = $54, Starter's cap
  })
  it('a removal stays on until the period ends and is not on the next renewal', async () => {
    const f = fake()
    const live = sub('priority', { addons: ['small_edit', 'big_change'] })
    expect(await changeAddon(deps(f), live, 'big_change', 'off')).toMatchObject({ ok: true, kind: 'removal_scheduled', effectiveAt: new Date(PERIOD_END * 1000).toISOString() })
    expect(f.raw.subscriptions.update).not.toHaveBeenCalled() // nothing changes now: still on, no credit
    expect(f.raw.invoices.create).not.toHaveBeenCalled()
    const [current, next] = phase2(f)
    expect(current.end_date).toBe(PERIOD_END)
    expect(current.items).toEqual(expect.arrayContaining([expect.objectContaining({ price: 'price_big' })]))
    expect(next.items).toEqual([{ price: 'price_priority', quantity: 1 }, { price: 'price_small', quantity: 1 }])
    const nextRenewal = (next.items as { price: string; quantity: number }[]).reduce((n, i) => n + ((PRICES[i.price] as { unit_amount: number }).unit_amount * i.quantity), 0)
    expect(nextRenewal).toBe(5500 + 500)
  })
})

describe('refused while a plan switch is scheduled', () => {
  const switchAhead = { items: [{ price: 'price_starter', quantity: 1 }], metadata: { plan_step: 'starter' } }
  it.each(['on', 'off', 'keep'] as const)('%s', async (action) => {
    const f = fake({ next: switchAhead })
    const s = sub('priority', { addons: action === 'on' ? [] : ['small_edit'], schedule: 'sub_sched_0' })
    expect(await changeAddon(deps(f), s, 'small_edit', action)).toMatchObject({ ok: false, code: 'pending_switch' })
    expect(f.raw.subscriptions.update).not.toHaveBeenCalled()
    expect(f.raw.subscriptionSchedules.update).not.toHaveBeenCalled()
  })
})

describe('turning an add-on OFF: at the end of the billing period', () => {
  it('next phase = live step + the add-ons left + the live tip; nothing charged or credited', async () => {
    const f = fake()
    const r = await changeAddon(deps(f), sub('starter', { addons: ['small_edit', 'big_change'], tip: 8 }), 'small_edit', 'off')
    expect(r).toEqual({ ok: true, kind: 'removal_scheduled', addon: 'small_edit', effectiveAt: new Date(PERIOD_END * 1000).toISOString() })
    expect(f.raw.subscriptions.update).not.toHaveBeenCalled()
    const [p1, p2] = phase2(f)
    expect(p1.end_date).toBe(PERIOD_END)
    expect(p2.items).toEqual([{ price: 'price_starter', quantity: 1 }, { price: 'price_big', quantity: 1 }, { price: 'price_tip', quantity: 8 }])
    expect(p2.metadata).toEqual({ plan_step: 'starter', addons: 'big_change', tip_dollars: '8', kind: 'addons' })
    const params = (f.raw.subscriptionSchedules.update.mock.calls[0] as unknown as [string, Record<string, unknown>])[1]
    expect(params).toMatchObject({ proration_behavior: 'none', end_behavior: 'release' })
  })
  it('the preview gives the end date and the next bill without it', async () => {
    const p = await previewAddonChange(deps(fake()), sub('priority', { addons: ['small_edit', 'big_change'], tip: 2 }), 'big_change', 'off', NOW_S)
    expect(p).toEqual({ ok: true, action: 'off', addon: 'big_change', effectiveAt: new Date(PERIOD_END * 1000).toISOString(), nextAmountCents: 5500 + 500 + 200, nextBillingAt: new Date(PERIOD_END * 1000).toISOString(), unchanged: false })
  })
  it('a second removal edits the same next phase; turning another ON waits; "Keep it" undoes one', async () => {
    const pending = { items: [{ price: 'price_priority', quantity: 1 }, { price: 'price_small', quantity: 1 }], metadata: { plan_step: 'priority', addons: 'small_edit', tip_dollars: '0', kind: 'addons' } }
    const live = sub('priority', { addons: ['small_edit', 'big_change'], schedule: 'sub_sched_0' })
    const f = fake({ next: pending })
    expect(await changeAddon(deps(f), live, 'small_edit', 'off')).toMatchObject({ ok: true, kind: 'removal_scheduled' })
    expect(phase2(f)[1].items).toEqual([{ price: 'price_priority', quantity: 1 }])
    const g = fake({ next: pending })
    expect(await changeAddon(deps(g), sub('priority', { addons: ['big_change'], schedule: 'sub_sched_0' }), 'small_edit', 'on')).toMatchObject({ ok: false, code: 'pending_addons' })
    const h = fake({ next: pending })
    expect(await changeAddon(deps(h), live, 'big_change', 'keep')).toEqual({ ok: true, kind: 'kept', addon: 'big_change', effectiveAt: null })
    expect(h.calls).toContain('schedules.release') // the next phase would equal today's items
  })
  it('tip changes wait while an add-on removal is pending', async () => {
    const f = fake({ next: { items: [{ price: 'price_priority', quantity: 1 }], metadata: { plan_step: 'priority', addons: '', tip_dollars: '0', kind: 'addons' } } })
    const r = await changeTip({ stripe: f.stripe, tipPriceId: async () => 'price_tip' }, sub('priority', { addons: ['big_change'], schedule: 'sub_sched_0' }), 3, { now: NOW })
    expect(r).toMatchObject({ ok: false, code: 'pending_change' })
  })
})

describe('plan switches made while an add-on removal is pending', () => {
  const removal = { items: [{ price: 'price_starter', quantity: 1 }, { price: 'price_tip', quantity: 4 }], metadata: { plan_step: 'starter', addons: '', tip_dollars: '4', kind: 'addons' } }
  it('upgrade: charged with the add-on still on, then the removal is scheduled again on the new step', async () => {
    const after = sub('priority', { addons: ['small_edit'] })
    const f = fake({ next: removal, after })
    ;(f.raw.subscriptions.update as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(async () => (f.calls.push('subscriptions.update'), { ...after, pending_update: null, latest_invoice: { id: 'in_new', status: 'paid' } }))
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, sub('starter', { addons: ['small_edit'], tip: 4, schedule: 'sub_sched_0' }), 'priority')
    expect(r).toMatchObject({ ok: true, kind: 'upgraded', addonRemovalKept: true })
    expect(f.calls).toEqual(['schedules.retrieve', 'schedules.release', 'subscriptions.update', 'schedules.create', 'schedules.update'])
    expect(phase2(f)[1]).toMatchObject({ items: [{ price: 'price_priority', quantity: 1 }], metadata: { plan_step: 'priority', addons: '', kind: 'addons' } })
  })
  it('upgrade with a declined card puts the add-on removal back (with its tip)', async () => {
    const f = fake({ next: removal, cardError: true })
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW, log: () => {} }, sub('starter', { addons: ['small_edit'], tip: 4, schedule: 'sub_sched_0' }), 'priority')
    expect(r).toMatchObject({ ok: false, code: 'payment_failed', pendingRestored: true })
    expect(phase2(f)[1]).toMatchObject({ items: [{ price: 'price_starter', quantity: 1 }, { price: 'price_tip', quantity: 4 }], metadata: { plan_step: 'starter', addons: '', tip_dollars: '4', kind: 'addons' } })
  })
  it('"keep my plan" cancels a switch but keeps an add-on removal planned with it', async () => {
    const f = fake({ next: { items: [{ price: 'price_starter', quantity: 1 }], metadata: { plan_step: 'starter', addons: '', tip_dollars: '0', kind: 'switch' } } })
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, sub('priority', { addons: ['big_change'], tip: 2, schedule: 'sub_sched_0' }), 'priority')
    expect(r).toEqual({ ok: true, kind: 'unchanged', step: 'priority' })
    expect(f.calls).not.toContain('schedules.release')
    expect(phase2(f)[1]).toMatchObject({ items: [{ price: 'price_priority', quantity: 1 }, { price: 'price_tip', quantity: 2 }], metadata: { plan_step: 'priority', addons: '', tip_dollars: '2', kind: 'addons' } })
  })
  it('"keep my plan" with only a switch pending still just releases it', async () => {
    const f = fake({ next: { items: [{ price: 'price_starter', quantity: 1 }, { price: 'price_big', quantity: 1 }], metadata: { plan_step: 'starter', addons: 'big_change', tip_dollars: '0', kind: 'switch' } } })
    await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, sub('priority', { addons: ['big_change'], schedule: 'sub_sched_0' }), 'priority')
    expect(f.calls).toContain('schedules.release')
    expect(f.raw.subscriptionSchedules.update).not.toHaveBeenCalled()
  })
})

describe('tip changes count add-ons on Starter', () => {
  it('Starter + small edit: $14 is the max, $15 is refused', async () => {
    const f = fake({ after: sub('starter', { addons: ['small_edit'], tip: 14 }) })
    const t = { stripe: f.stripe, tipPriceId: async () => 'price_tip' }
    expect(await changeTip(t, sub('starter', { addons: ['small_edit'] }), 15, { now: NOW })).toMatchObject({ ok: false, code: 'out_of_range' })
    expect(await changeTip(t, sub('starter', { addons: ['small_edit'] }), 14, { now: NOW })).toMatchObject({ ok: true, kind: 'changed', nextAmountCents: 3500 + 500 + 1400 })
  })
})
