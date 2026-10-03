// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { PLAN_STEPS, type PlanStepId } from '@/lib/plans/ladder'
import {
  PRORATION_DATE_MAX_AGE_SECONDS,
  cancelPlanAtPeriodEnd,
  changePlanStep,
  checkProrationDate,
  pendingPlanChange,
  planMove,
  previewPlanStepChange,
  subscriptionMonthlyCents,
  upgradeIdempotencyKey,
  currentLadderStep,
  subscriptionTipDollars,
  upgradeItems,
  changeTip,
  tipChangeIdempotencyKey,
  previewTipChange,
} from './change-plan'

const step = (id: PlanStepId) => PLAN_STEPS.find((s) => s.id === id)!
const ladderSub = (id: PlanStepId, over: Record<string, unknown> = {}) =>
  ({
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    schedule: null,
    items: { data: [{ id: 'si_1', quantity: 1, price: { id: `price_${id}`, lookup_key: step(id).lookupKey, unit_amount: step(id).monthlyCents, recurring: { interval: 'month' } } }] },
    ...over,
  }) as unknown as Stripe.Subscription
const legacySub = (hosting: number, addon: number) =>
  ({
    id: 'sub_L',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    schedule: null,
    items: {
      data: [
        { id: 'si_h', quantity: 1, price: { id: 'price_adhoc_h', lookup_key: null, unit_amount: hosting, recurring: { interval: 'month' } } },
        { id: 'si_a', quantity: 1, price: { id: 'price_adhoc_a', lookup_key: null, unit_amount: addon, recurring: { interval: 'month' } } },
      ],
    },
  }) as unknown as Stripe.Subscription

const NOW = new Date('2026-10-03T17:00:00Z')
const NOW_S = Math.floor(NOW.getTime() / 1000)
const PERIOD_END = 1_793_726_938 // Nov 3 2026

function fakeStripe(opts: { pendingUpdate?: boolean; cardError?: boolean; pendingStep?: PlanStepId | null; phaseMetadata?: boolean } = {}) {
  const calls: string[] = []
  const pendingStep = opts.pendingStep === undefined ? 'priority' : opts.pendingStep
  const stripe = {
    subscriptions: {
      update: vi.fn(async (id: string, params: Record<string, unknown>) => {
        calls.push(params.cancel_at_period_end ? 'subscriptions.update(cancel)' : 'subscriptions.update')
        if (opts.cardError && !params.cancel_at_period_end) throw Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError', code: 'card_declined' })
        return { id, pending_update: opts.pendingUpdate ? { expires_at: 1 } : null, latest_invoice: { id: 'in_new', status: opts.pendingUpdate ? 'open' : 'paid' } }
      }),
    },
    invoices: { voidInvoice: vi.fn(async (id: string) => (calls.push(`invoices.void:${id}`), { id, status: 'void' })) },
    prices: { retrieve: vi.fn(async (id: string) => (calls.push('prices.retrieve'), { id, lookup_key: `freeplug_step_${id.replace('price_', '')}_monthly` })) },
    subscriptionSchedules: {
      create: vi.fn(async () => {
        calls.push('schedules.create')
        return { id: 'sub_sched_1', current_phase: { start_date: 1_790_000_000, end_date: 1_792_600_000 }, phases: [{ start_date: 1_790_000_000, end_date: 1_792_600_000, items: [{ price: 'price_leads', quantity: 1 }] }] }
      }),
      retrieve: vi.fn(async () => {
        calls.push('schedules.retrieve')
        return {
          id: 'sub_sched_0',
          status: 'active',
          current_phase: { start_date: NOW_S - 86_400, end_date: PERIOD_END },
          phases: [
            { start_date: NOW_S - 86_400, end_date: PERIOD_END, items: [{ price: 'price_leads', quantity: 1 }], metadata: {} },
            ...(pendingStep
              ? [{ start_date: PERIOD_END, end_date: PERIOD_END + 2_592_000, items: [{ price: `price_${pendingStep}`, quantity: 1 }], metadata: opts.phaseMetadata === false ? {} : { plan_step: pendingStep } }]
              : []),
          ],
        }
      }),
      update: vi.fn(async () => (calls.push('schedules.update'), {})),
      release: vi.fn(async () => (calls.push('schedules.release'), {})),
    },
  }
  return { stripe: stripe as unknown as Stripe, raw: stripe, calls }
}
const priceIdFor = async (id: PlanStepId) => `price_${id}`

describe('planMove', () => {
  it.each([
    ['starter', 3500, 'leads', 'upgrade'],
    ['leads', 7500, 'priority', 'downgrade'],
    ['leads', 7500, 'leads', 'same'],
    [null, 5500, 'priority', 'upgrade'], // legacy $40 + Pro = $55 -> Priority: applied now, no proration
    [null, 5000, 'starter', 'downgrade'], // legacy $35 + Pro -> Starter: at period end
    [null, 5000, 'priority', 'upgrade'],
  ] as const)('%s ($%i) -> %s = %s', (cur, cents, target, move) => {
    expect(planMove(cur ? step(cur) : null, cents, step(target))).toBe(move)
  })
  it('monthly total counts every item (legacy hosting + add-on)', () => {
    expect(subscriptionMonthlyCents(legacySub(4000, 1500))).toBe(5500)
  })
})

describe('changePlanStep (upgrades now + prorated, downgrades at period end)', () => {
  it('upgrade: replaces the item with the step price, always_invoice, pending_if_incomplete, idempotent', async () => {
    const f = fakeStripe()
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter'), 'fast_lane')
    expect(r).toEqual({ ok: true, kind: 'upgraded', step: 'fast_lane', invoiceStatus: 'paid' })
    const [id, params, opts] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams, { idempotencyKey: string }]
    expect(id).toBe('sub_1')
    expect(params).toMatchObject({ items: [{ id: 'si_1', price: 'price_fast_lane', quantity: 1 }], proration_behavior: 'always_invoice', payment_behavior: 'pending_if_incomplete' })
    expect(opts.idempotencyKey).toBe('plan-move:na:fast_lane:now:sub_1:price_starter:none')
    expect(params).not.toHaveProperty('proration_date')
    expect(f.raw.subscriptionSchedules.create).not.toHaveBeenCalled()
  })

  it('upgrade with a failed card: Stripe keeps the old plan (pending update), we void its invoice and say so', async () => {
    const f = fakeStripe({ pendingUpdate: true })
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter'), 'fast_lane')).toEqual({
      ok: false,
      code: 'payment_failed',
      message: expect.any(String),
      pendingRestored: null,
    })
    expect(f.calls).toEqual(['subscriptions.update', 'invoices.void:in_new'])
  })

  it('a card error thrown by Stripe is also a clean payment_failed (nothing else written)', async () => {
    const f = fakeStripe({ cardError: true })
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter'), 'priority')).toMatchObject({ ok: false, code: 'payment_failed' })
    expect(f.calls).toEqual(['subscriptions.update'])
  })

  it('a retry after a failed card is a new Stripe request (idempotency key carries the latest invoice)', async () => {
    const f = fakeStripe()
    await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter', { latest_invoice: 'in_void_1' }), 'priority')
    const [, , opts] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, unknown, { idempotencyKey: string }]
    expect(opts.idempotencyKey).toBe('plan-move:na:priority:now:sub_1:price_starter:in_void_1')
  })

  it('downgrade: no subscription update; a schedule moves to the step price at the period end', async () => {
    const f = fakeStripe()
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('leads'), 'priority')
    expect(r).toEqual({ ok: true, kind: 'scheduled', step: 'priority', effectiveAt: new Date(1_792_600_000 * 1000).toISOString() })
    expect(f.raw.subscriptions.update).not.toHaveBeenCalled()
    expect(f.raw.subscriptionSchedules.create).toHaveBeenCalledWith({ from_subscription: 'sub_1' })
    const [, params] = f.raw.subscriptionSchedules.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionScheduleUpdateParams]
    expect(params.end_behavior).toBe('release')
    expect(params.phases?.[0]).toMatchObject({ items: [{ price: 'price_leads', quantity: 1 }], start_date: 1_790_000_000, end_date: 1_792_600_000, proration_behavior: 'none' })
    expect(params.phases?.[1]).toMatchObject({ items: [{ price: 'price_priority', quantity: 1 }], proration_behavior: 'none' })
  })

  it('picking the current step cancels a pending downgrade and changes nothing else', async () => {
    const f = fakeStripe()
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('leads', { schedule: 'sub_sched_0' }), 'leads')
    expect(r).toEqual({ ok: true, kind: 'unchanged', step: 'leads' })
    expect(f.calls).toEqual(['schedules.release'])
  })

  it('an upgrade while a downgrade is pending releases the schedule first', async () => {
    const f = fakeStripe()
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, ladderSub('priority', { schedule: 'sub_sched_0' }), 'fast_lane')
    expect(r).toMatchObject({ ok: true, kind: 'upgraded', step: 'fast_lane' })
    expect(f.calls).toEqual(['schedules.retrieve', 'schedules.release', 'subscriptions.update'])
  })

  it('an upgrade that fails on the card after releasing a pending downgrade puts the downgrade back', async () => {
    const f = fakeStripe({ pendingUpdate: true, pendingStep: 'starter' })
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, ladderSub('priority', { schedule: 'sub_sched_0' }), 'fast_lane')
    expect(r).toMatchObject({ ok: false, code: 'payment_failed', pendingRestored: true })
    expect(f.calls).toEqual(['schedules.retrieve', 'schedules.release', 'subscriptions.update', 'invoices.void:in_new', 'schedules.create', 'schedules.update'])
    const [, params] = f.raw.subscriptionSchedules.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionScheduleUpdateParams]
    expect(params.phases?.[1]).toMatchObject({ items: [{ price: 'price_starter', quantity: 1 }], metadata: { plan_step: 'starter' } })
  })

  it('a grandfathered plan moves only when the customer picks a step: all old items are replaced on upgrade', async () => {
    const f = fakeStripe()
    await changePlanStep({ stripe: f.stripe, priceIdFor }, legacySub(4000, 1500), 'fast_lane')
    const [, params] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams]
    expect(params.items).toEqual([{ id: 'si_h', price: 'price_fast_lane', quantity: 1 }, { id: 'si_a', deleted: true }])
  })

  it('refuses an ending or ended plan, and a missing price, without writing anything', async () => {
    const f = fakeStripe()
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter', { cancel_at_period_end: true }), 'leads')).toMatchObject({ code: 'ending' })
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter', { status: 'canceled' }), 'leads')).toMatchObject({ code: 'not_live' })
    expect(
      await changePlanStep({ stripe: f.stripe, priceIdFor: async () => { throw new Error('no price') } }, ladderSub('starter'), 'priority')
    ).toMatchObject({ code: 'price' })
    expect(f.calls).toEqual([])
  })

  it('sellable=false: refuses moving TO the step (up or down) on the server, without writing', async () => {
    const f = fakeStripe()
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter'), 'leads')).toMatchObject({ ok: false, code: 'not_sellable' })
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('growth'), 'get_found')).toMatchObject({ ok: false, code: 'not_sellable' })
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, legacySub(4000, 1500), 'growth')).toMatchObject({ ok: false, code: 'not_sellable' })
    expect(f.calls).toEqual([])
  })

  it('sellable=false: a customer already on the step keeps it, can keep it, and can move to a sellable step', async () => {
    const f = fakeStripe()
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('growth', { schedule: 'sub_sched_0' }), 'growth')).toEqual({ ok: true, kind: 'unchanged', step: 'growth' })
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('growth'), 'fast_lane')).toMatchObject({ ok: true, kind: 'scheduled', step: 'fast_lane' })
  })
})

describe('pending downgrade (shown on the Plans page with its date)', () => {
  it('reads the next phase: step from phase metadata, date = phase start', async () => {
    const f = fakeStripe({ pendingStep: 'priority' })
    expect(await pendingPlanChange(f.stripe, { schedule: 'sub_sched_0' }, NOW)).toEqual({
      step: 'priority',
      effectiveAt: new Date(PERIOD_END * 1000).toISOString(),
      scheduleId: 'sub_sched_0',
    })
    expect(f.calls).toEqual(['schedules.retrieve'])
  })
  it('falls back to the price lookup key when the phase has no metadata', async () => {
    const f = fakeStripe({ pendingStep: 'starter', phaseMetadata: false })
    expect(await pendingPlanChange(f.stripe, { schedule: { id: 'sub_sched_0' } as unknown as Stripe.SubscriptionSchedule }, NOW)).toMatchObject({ step: 'starter' })
  })
  it('null without a schedule or without a later phase', async () => {
    const f = fakeStripe({ pendingStep: null })
    expect(await pendingPlanChange(f.stripe, { schedule: null }, NOW)).toBeNull()
    expect(await pendingPlanChange(f.stripe, { schedule: 'sub_sched_0' }, NOW)).toBeNull()
  })
})

describe('cancel at period end vs a pending downgrade (both orders)', () => {
  it('downgrade then cancel: the schedule is released FIRST, then cancel_at_period_end is set', async () => {
    const f = fakeStripe({ pendingStep: 'priority' })
    const sub = ladderSub('leads')
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, sub, 'priority')).toMatchObject({ ok: true, kind: 'scheduled' })
    f.calls.length = 0
    const r = await cancelPlanAtPeriodEnd(f.stripe, ladderSub('leads', { schedule: 'sub_sched_1' }), NOW)
    expect(r).toEqual({ ok: true, kind: 'canceled', clearedPendingChange: { step: 'priority', effectiveAt: new Date(PERIOD_END * 1000).toISOString(), scheduleId: 'sub_sched_0' } })
    expect(f.calls).toEqual(['schedules.retrieve', 'schedules.release', 'subscriptions.update(cancel)'])
    const [, params, o] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Record<string, unknown>, { idempotencyKey: string }]
    expect(params).toEqual({ cancel_at_period_end: true })
    expect(o.idempotencyKey).toBe('plan-cancel:sub_1:sub_sched_1')
  })

  it('cancel then downgrade: refused cleanly (resume first), nothing written', async () => {
    const f = fakeStripe()
    expect(await cancelPlanAtPeriodEnd(f.stripe, ladderSub('leads'), NOW)).toMatchObject({ ok: true, kind: 'canceled', clearedPendingChange: null })
    f.calls.length = 0
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('leads', { cancel_at_period_end: true }), 'priority')).toMatchObject({ ok: false, code: 'ending' })
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('leads', { cancel_at: PERIOD_END }), 'fast_lane')).toMatchObject({ ok: false, code: 'ending' })
    expect(f.calls).toEqual([])
  })

  it('cancel on a plan already ending changes nothing; an ended plan is not_live', async () => {
    const f = fakeStripe()
    expect(await cancelPlanAtPeriodEnd(f.stripe, ladderSub('leads', { cancel_at_period_end: true }), NOW)).toMatchObject({ kind: 'already_ending' })
    expect(await cancelPlanAtPeriodEnd(f.stripe, ladderSub('leads', { status: 'canceled' }), NOW)).toMatchObject({ ok: false, code: 'not_live' })
    expect(f.calls).toEqual([])
  })
})

describe('entitlements are never written by a plan move', () => {
  it('changePlanStep and cancelPlanAtPeriodEnd only take Stripe (no profile/plan_step store exists in their deps)', () => {
    expect(changePlanStep.length).toBe(3)
    expect(cancelPlanAtPeriodEnd.length).toBe(2)
  })
})

describe('upgrade confirm: preview + proration_date (Aria, Oct 3 1:34 PM)', () => {
  const withPreview = () => {
    const f = fakeStripe()
    const createPreview = vi.fn(async () => ({ amount_due: 1953, currency: 'usd', total: 1953 }))
    ;(f.raw as unknown as { invoices: Record<string, unknown> }).invoices.createPreview = createPreview
    return { ...f, createPreview }
  }
  const periodSub = (id: PlanStepId, over: Record<string, unknown> = {}) => {
    const sub = ladderSub(id, over) as unknown as { items: { data: Record<string, unknown>[] } }
    sub.items.data[0].current_period_end = PERIOD_END
    return sub as unknown as Stripe.Subscription
  }

  it('checkProrationDate: ok within 10 minutes, stale after, future and junk refused', () => {
    expect(PRORATION_DATE_MAX_AGE_SECONDS).toBe(600)
    expect(checkProrationDate(NOW_S, NOW)).toBe('ok')
    expect(checkProrationDate(NOW_S - 600, NOW)).toBe('ok')
    expect(checkProrationDate(NOW_S - 601, NOW)).toBe('stale')
    expect(checkProrationDate(NOW_S + 1, NOW)).toBe('future')
    for (const junk of ['1790000000', 1.5, -1, 0, null, undefined, Number.NaN]) expect(checkProrationDate(junk, NOW)).toBe('invalid')
  })

  it('preview: read-only createPreview with the same items, always_invoice and the server proration_date', async () => {
    const f = withPreview()
    const p = await previewPlanStepChange({ stripe: f.stripe, priceIdFor }, periodSub('starter'), 'fast_lane', NOW_S)
    expect(p).toEqual({
      ok: true,
      step: 'fast_lane',
      prorationDate: NOW_S,
      amountDueCents: 1953,
      currency: 'usd',
      nextAmountCents: 6500,
      nextBillingAt: new Date(PERIOD_END * 1000).toISOString(),
      tipDollars: 0,
    })
    expect(f.createPreview).toHaveBeenCalledWith({
      subscription: 'sub_1',
      subscription_details: { items: [{ id: 'si_1', price: 'price_fast_lane', quantity: 1 }], proration_behavior: 'always_invoice', proration_date: NOW_S },
    })
    expect(f.calls).toEqual([]) // nothing written
  })

  it('preview: a grandfathered plan replaces the hosting item and deletes the add-on, like the update', async () => {
    const f = withPreview()
    await previewPlanStepChange({ stripe: f.stripe, priceIdFor }, legacySub(4000, 1500), 'fast_lane', NOW_S)
    expect(f.createPreview.mock.calls[0]).toEqual([
      expect.objectContaining({ subscription_details: expect.objectContaining({ items: [{ id: 'si_h', price: 'price_fast_lane', quantity: 1 }, { id: 'si_a', deleted: true }] }) }),
    ])
  })

  it('preview: downgrades, the same step, non-sellable targets and ending plans get no preview (no confirm)', async () => {
    const f = withPreview()
    expect(await previewPlanStepChange({ stripe: f.stripe, priceIdFor }, periodSub('fast_lane'), 'starter', NOW_S)).toMatchObject({ ok: false, code: 'not_upgrade' })
    expect(await previewPlanStepChange({ stripe: f.stripe, priceIdFor }, periodSub('fast_lane'), 'fast_lane', NOW_S)).toMatchObject({ ok: false, code: 'not_upgrade' })
    expect(await previewPlanStepChange({ stripe: f.stripe, priceIdFor }, periodSub('starter'), 'leads', NOW_S)).toMatchObject({ ok: false, code: 'not_sellable' })
    expect(await previewPlanStepChange({ stripe: f.stripe, priceIdFor }, periodSub('starter', { cancel_at_period_end: true }), 'priority', NOW_S)).toMatchObject({ ok: false, code: 'ending' })
    expect(f.createPreview).not.toHaveBeenCalled()
  })

  it('confirm: the proration_date goes to the update, and the idempotency key is user + step + proration_date', async () => {
    const f = fakeStripe()
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, ladderSub('starter'), 'fast_lane', { prorationDate: NOW_S - 120, userId: 'u1' })
    expect(r).toMatchObject({ ok: true, kind: 'upgraded' })
    const [, params, opts] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams, { idempotencyKey: string }]
    expect(params.proration_date).toBe(NOW_S - 120)
    expect(params.proration_behavior).toBe('always_invoice')
    expect(opts.idempotencyKey).toBe(`plan-move:u1:fast_lane:${NOW_S - 120}:sub_1:price_starter:none`)
  })

  it.each([
    ['stale (10 min + 1 s)', NOW_S - 601],
    ['future', NOW_S + 30],
  ])('confirm with a %s proration_date is refused before anything changes in Stripe', async (_label, pd) => {
    const f = fakeStripe()
    const sub = ladderSub('priority', { schedule: 'sub_sched_0' }) // even a pending downgrade is left alone
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, sub, 'fast_lane', { prorationDate: pd, userId: 'u1' })
    expect(r).toMatchObject({ ok: false, code: 'stale_preview' })
    expect(f.calls).toEqual([])
    expect(f.raw.subscriptions.update).not.toHaveBeenCalled()
  })

  it('a double Confirm sends the identical update (same key, same params), so Stripe charges once', async () => {
    const f = fakeStripe()
    const deps = { stripe: f.stripe, priceIdFor, now: () => NOW }
    const opts = { prorationDate: NOW_S - 5, userId: 'u1' }
    await Promise.all([changePlanStep(deps, ladderSub('starter'), 'priority', opts), changePlanStep(deps, ladderSub('starter'), 'priority', opts)])
    const calls = f.raw.subscriptions.update.mock.calls as unknown as [string, unknown, { idempotencyKey: string }][]
    expect(calls).toHaveLength(2)
    expect(calls[0][2].idempotencyKey).toBe(calls[1][2].idempotencyKey)
    expect(calls[0][1]).toEqual(calls[1][1])
    // and a confirm after the switch landed is "same": no second update at all
    const after = await changePlanStep(deps, ladderSub('priority'), 'priority', opts)
    expect(after).toEqual({ ok: true, kind: 'unchanged', step: 'priority' })
    expect(f.raw.subscriptions.update).toHaveBeenCalledTimes(2)
  })

  it('the second of two concurrent Confirms gets Stripe 409 (key in use): in_progress, and the pending downgrade is NOT put back', async () => {
    const f = fakeStripe()
    f.raw.subscriptions.update.mockRejectedValueOnce(Object.assign(new Error('another in-progress request'), { type: 'StripeIdempotencyError', code: 'idempotency_key_in_use' }))
    const sub = ladderSub('priority', { schedule: 'sub_sched_0' })
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW }, sub, 'fast_lane', { prorationDate: NOW_S - 5, userId: 'u1' })
    expect(r).toMatchObject({ ok: false, code: 'in_progress' })
    expect(f.calls.filter((c) => c.startsWith('schedules.create') || c.startsWith('schedules.update'))).toEqual([])
  })

  it('a different user, step or proration_date is a different key', () => {
    const sub = ladderSub('starter')
    const k = upgradeIdempotencyKey(sub, 'priority', { prorationDate: 100, userId: 'u1' })
    expect(upgradeIdempotencyKey(sub, 'priority', { prorationDate: 100, userId: 'u2' })).not.toBe(k)
    expect(upgradeIdempotencyKey(sub, 'fast_lane', { prorationDate: 100, userId: 'u1' })).not.toBe(k)
    expect(upgradeIdempotencyKey(sub, 'priority', { prorationDate: 101, userId: 'u1' })).not.toBe(k)
  })
})

// ------------------------------------------------------------------ the tipping system (Oct 3)

describe('the tipping system: tip item vs plan changes', () => {
  const TIP_PRICE = { id: 'price_tip', lookup_key: 'freeplug_tip_monthly', unit_amount: 100, recurring: { interval: 'month' }, product: 'freeplug_tip' }
  const tipped = (id: PlanStepId, tip: number, over: Record<string, unknown> = {}, tipFirst = false) => {
    const sub = ladderSub(id, over) as unknown as { items: { data: Record<string, unknown>[] } }
    sub.items.data[0].current_period_end = PERIOD_END
    const tipItem = { id: 'si_tip', quantity: tip, price: TIP_PRICE, current_period_end: PERIOD_END }
    sub.items.data = tipFirst ? [tipItem, ...sub.items.data] : [...sub.items.data, tipItem]
    return sub as unknown as Stripe.Subscription
  }
  const tipDeps = (f: ReturnType<typeof fakeStripe>) => ({ stripe: f.stripe, priceIdFor, tipPriceId: async () => 'price_tip' })

  it('tier lookup ignores the tip item (any order); the plan price never includes the tip', () => {
    for (const first of [false, true]) {
      const s = tipped('priority', 7, {}, first)
      expect(currentLadderStep(s)?.id).toBe('priority')
      expect(subscriptionMonthlyCents(s)).toBe(5500)
      expect(subscriptionTipDollars(s)).toBe(7)
    }
    // Priority + $9 tip ($64) moving to Fast lane ($65) is an upgrade, not "same"
    expect(planMove(currentLadderStep(tipped('priority', 9)), subscriptionMonthlyCents(tipped('priority', 9)), step('fast_lane'))).toBe('upgrade')
  })

  it('upgrade keeps the TIER item (even when the tip item comes first) and deletes the tip: the tip resets to $0', async () => {
    expect(upgradeItems(tipped('starter', 10, {}, true), 'price_fast_lane')).toEqual([
      { id: 'si_1', price: 'price_fast_lane', quantity: 1 },
      { id: 'si_tip', deleted: true },
    ])
    const f = fakeStripe()
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor }, tipped('starter', 10), 'fast_lane')
    expect(r).toMatchObject({ ok: true, kind: 'upgraded' })
    const [, params] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams]
    expect(params.items).toEqual([{ id: 'si_1', price: 'price_fast_lane', quantity: 1 }, { id: 'si_tip', deleted: true }])
  })

  it('the upgrade preview includes the tip removal (same items as the update) and reports the tip it ends', async () => {
    const f = fakeStripe()
    const createPreview = vi.fn(async () => ({ amount_due: 2000, currency: 'usd' }))
    ;(f.raw as unknown as { invoices: Record<string, unknown> }).invoices.createPreview = createPreview
    const p = await previewPlanStepChange({ stripe: f.stripe, priceIdFor }, tipped('starter', 10), 'fast_lane', NOW_S)
    expect(p).toMatchObject({ ok: true, amountDueCents: 2000, nextAmountCents: 6500, tipDollars: 10 })
    expect(createPreview).toHaveBeenCalledWith({
      subscription: 'sub_1',
      subscription_details: { items: [{ id: 'si_1', price: 'price_fast_lane', quantity: 1 }, { id: 'si_tip', deleted: true }], proration_behavior: 'always_invoice', proration_date: NOW_S },
    })
  })

  it('downgrade: the schedule keeps the tip until the switch, and the next phase holds ONLY the new step price', async () => {
    const f = fakeStripe()
    ;(f.raw.subscriptionSchedules.create as unknown as { mockImplementationOnce: (fn: () => unknown) => void }).mockImplementationOnce(async () => ({
      id: 'sub_sched_1',
      current_phase: { start_date: 1_790_000_000, end_date: 1_792_600_000 },
      phases: [{ start_date: 1_790_000_000, end_date: 1_792_600_000, items: [{ price: 'price_fast_lane', quantity: 1 }, { price: 'price_tip', quantity: 6 }] }],
    }))
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor }, tipped('fast_lane', 6), 'priority')
    expect(r).toMatchObject({ ok: true, kind: 'scheduled', step: 'priority' })
    const [, params] = f.raw.subscriptionSchedules.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionScheduleUpdateParams]
    expect(params.phases?.[0].items).toEqual([{ price: 'price_fast_lane', quantity: 1 }, { price: 'price_tip', quantity: 6 }])
    expect(params.phases?.[1].items).toEqual([{ price: 'price_priority', quantity: 1 }])
    expect(f.raw.subscriptions.update).not.toHaveBeenCalled()
  })

  /**
   * A Stripe-like fake for tip changes: it applies item params to its own copy of the subscription and
   * replays the stored response for a reused idempotency key WITHOUT applying anything (what Stripe does).
   */
  function idemStripe(start: Stripe.Subscription) {
    const state = JSON.parse(JSON.stringify(start)) as { items: { data: Record<string, unknown>[] } }
    const seen = new Map<string, unknown>()
    const update = vi.fn(async (_id: string, params: { items: Record<string, unknown>[] }, o: { idempotencyKey: string }) => {
      if (seen.has(o.idempotencyKey)) return JSON.parse(JSON.stringify(seen.get(o.idempotencyKey)))
      for (const it of params.items) {
        if (it.deleted) state.items.data = state.items.data.filter((x) => x.id !== it.id)
        else if (it.id) state.items.data.find((x) => x.id === it.id)!.quantity = it.quantity
        else state.items.data.push({ id: `si_new_${state.items.data.length}`, quantity: it.quantity, price: TIP_PRICE, current_period_end: PERIOD_END })
      }
      const res = { id: 'sub_1', items: { data: JSON.parse(JSON.stringify(state.items.data)) } }
      seen.set(o.idempotencyKey, res)
      return JSON.parse(JSON.stringify(res))
    })
    const retrieve = vi.fn(async () => ({ id: 'sub_1', items: { data: JSON.parse(JSON.stringify(state.items.data)) } }))
    const stripe = { subscriptions: { update, retrieve } } as unknown as Stripe
    const live = () => JSON.parse(JSON.stringify({ ...start, items: state.items })) as Stripe.Subscription
    const tip = () => (state.items.data.find((x) => (x.price as { id: string }).id === 'price_tip')?.quantity as number | undefined) ?? 0
    return { deps: { stripe, priceIdFor, tipPriceId: async () => 'price_tip' }, update, live, tip }
  }

  it('tip change: next cycle only (proration none), up / down / to $0 / added; one key per Confirm', async () => {
    const cases: [number, number, unknown][] = [
      [6, 9, [{ id: 'si_tip', quantity: 9 }]],
      [6, 2, [{ id: 'si_tip', quantity: 2 }]],
      [6, 0, [{ id: 'si_tip', deleted: true }]],
      [0, 4, [{ price: 'price_tip', quantity: 4 }]],
    ]
    for (const [from, to, items] of cases) {
      const sub = tipped('fast_lane', from)
      if (from === 0) (sub.items.data as unknown[]).pop()
      const f = idemStripe(sub)
      const r = await changeTip(f.deps, sub, to, { userId: 'u1', now: NOW, confirmId: 'confirm-abc123' })
      expect(r).toMatchObject({ ok: true, kind: 'changed', tipDollars: to, nextAmountCents: 6500 + to * 100, nextBillingAt: new Date(PERIOD_END * 1000).toISOString() })
      const [id, params, opts] = f.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams, { idempotencyKey: string }]
      expect(id).toBe('sub_1')
      expect(params).toEqual({ items, proration_behavior: 'none' })
      expect(opts.idempotencyKey).toBe(`tip-change:u1:sub_1:confirm-abc123:${to}`)
      expect(f.tip()).toBe(to)
    }
  })

  it("Vera B2: $9 -> $4 -> $9 -> $4 inside one minute, one Confirm each: every change applies, Stripe ends at $4 (was: replayed, billed $64)", async () => {
    let sub = tipped('priority', 9)
    const f = idemStripe(sub)
    const seq: [number, string][] = [[4, 'confirm-0001'], [9, 'confirm-0002'], [4, 'confirm-0003']]
    for (const [to, confirmId] of seq) {
      const r = await changeTip(f.deps, sub, to, { userId: 'u1', now: NOW, confirmId }) // same minute every time
      expect(r).toMatchObject({ ok: true, kind: 'changed', tipDollars: to, nextAmountCents: 5500 + to * 100 })
      expect(f.tip()).toBe(to)
      sub = f.live()
    }
    expect(f.update).toHaveBeenCalledTimes(3)
    expect(new Set(f.update.mock.calls.map((c) => (c[2] as { idempotencyKey: string }).idempotencyKey)).size).toBe(3)
    expect(f.tip()).toBe(4) // next bill $59, matching what the customer was told
  })

  it('Vera B2, old key shape: the guard catches a replayed response (no "updated" message), even if a key repeats', async () => {
    let sub = tipped('priority', 9)
    const f = idemStripe(sub)
    // Simulate the old bug: the 3rd Confirm reuses the 1st Confirm's key (same id, same target).
    expect(await changeTip(f.deps, sub, 4, { userId: 'u1', confirmId: 'confirm-same' })).toMatchObject({ ok: true })
    sub = f.live()
    expect(await changeTip(f.deps, sub, 9, { userId: 'u1', confirmId: 'confirm-0002' })).toMatchObject({ ok: true })
    sub = f.live()
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const r = await changeTip(f.deps, sub, 4, { userId: 'u1', confirmId: 'confirm-same' })
    // Stripe replays the 1st response (tip 4, looks right); the live read shows 9.
    expect(r).toEqual({ ok: false, code: 'mismatch', message: 'Stripe did not apply the requested tip.' })
    expect(err).toHaveBeenCalledWith('[changeTip] MISMATCH after Stripe update', expect.objectContaining({ requestedTip: 4, stripeTip: 9 }))
    err.mockRestore()
    expect(f.tip()).toBe(9) // Stripe really holds 9; the app said so instead of "updated"
  })

  it('the same Confirm retried (double tap / network retry) dedupes: one Stripe change, same key', async () => {
    const sub = tipped('fast_lane', 2)
    const f = idemStripe(sub)
    const a = await changeTip(f.deps, sub, 6, { userId: 'u1', confirmId: 'confirm-tap' })
    const b = await changeTip(f.deps, sub, 6, { userId: 'u1', confirmId: 'confirm-tap' }) // retry with the stale sub
    expect(a).toMatchObject({ ok: true, tipDollars: 6 })
    expect(b).toMatchObject({ ok: true, tipDollars: 6 })
    const keys = f.update.mock.calls.map((c) => (c[2] as { idempotencyKey: string }).idempotencyKey)
    expect(keys).toEqual(['tip-change:u1:sub_1:confirm-tap:6', 'tip-change:u1:sub_1:confirm-tap:6'])
    expect(f.tip()).toBe(6)
  })

  it('mismatch guard: a response with another tip or step, or without items, fails loudly', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    for (const res of [
      { id: 'sub_1', items: { data: [tipped('fast_lane', 3).items.data[0], { id: 'si_tip', quantity: 3, price: TIP_PRICE }] } },
      { id: 'sub_1', items: { data: [tipped('priority', 5).items.data[0], { id: 'si_tip', quantity: 5, price: TIP_PRICE }] } },
      { id: 'sub_1' },
    ]) {
      const stripe = { subscriptions: { update: vi.fn(async () => res), retrieve: vi.fn(async () => res) } } as unknown as Stripe
      expect(await changeTip({ stripe, tipPriceId: async () => 'price_tip' }, tipped('fast_lane', 3), 5, { confirmId: 'confirm-mm01' })).toMatchObject({ ok: false, code: 'mismatch' })
    }
    err.mockRestore()
  })

  it('tipChangeIdempotencyKey: a valid Confirm id is used; anything else gets a fresh random id', () => {
    expect(tipChangeIdempotencyKey('u1', 'sub_1', 'confirm-abc123', 4)).toBe('tip-change:u1:sub_1:confirm-abc123:4')
    for (const bad of [undefined, '', 'short', 'has space here', 'x'.repeat(65), 42, { a: 1 }]) {
      const k1 = tipChangeIdempotencyKey('u1', 'sub_1', bad, 4)
      const k2 = tipChangeIdempotencyKey('u1', 'sub_1', bad, 4)
      expect(k1).toMatch(/^tip-change:u1:sub_1:r-[0-9a-f-]{36}:4$/)
      expect(k1).not.toBe(k2)
    }
  })

  it('tip change refused without a Stripe write: out of range, not a whole dollar, a planned switch, an ending plan, a grandfathered plan', async () => {
    const f = fakeStripe()
    const d = tipDeps(f)
    expect(await changeTip(d, tipped('fast_lane', 1), 10)).toMatchObject({ ok: false, code: 'out_of_range' }) // Fast lane: $65..$74
    expect(await changeTip(d, tipped('fast_lane', 1), 2.5)).toMatchObject({ ok: false, code: 'out_of_range' })
    expect(await changeTip(d, tipped('fast_lane', 1), -1)).toMatchObject({ ok: false, code: 'out_of_range' })
    expect(await changeTip(d, tipped('fast_lane', 1, { schedule: 'sub_sched_0' }), 3)).toMatchObject({ ok: false, code: 'pending_change' })
    expect(await changeTip(d, tipped('fast_lane', 1, { cancel_at_period_end: true }), 3)).toMatchObject({ ok: false, code: 'ending' })
    expect(await changeTip(d, legacySub(4000, 1500), 3)).toMatchObject({ ok: false, code: 'no_tip_plan' })
    expect(await changeTip(d, tipped('fast_lane', 3), 3)).toMatchObject({ ok: true, kind: 'unchanged' })
    expect(f.raw.subscriptions.update).not.toHaveBeenCalled()
  })

  it('tip preview: Stripe upcoming invoice with proration none ("Your next bill"), nothing written', async () => {
    const f = fakeStripe()
    const createPreview = vi.fn(async () => ({ amount_due: 7400, currency: 'usd' }))
    ;(f.raw as unknown as { invoices: Record<string, unknown> }).invoices.createPreview = createPreview
    const p = await previewTipChange(tipDeps(f), tipped('fast_lane', 3), 9)
    expect(p).toEqual({ ok: true, step: 'fast_lane', tipDollars: 9, nextAmountCents: 7400, currency: 'usd', nextBillingAt: new Date(PERIOD_END * 1000).toISOString(), unchanged: false })
    expect(createPreview).toHaveBeenCalledWith({ subscription: 'sub_1', subscription_details: { items: [{ id: 'si_tip', quantity: 9 }], proration_behavior: 'none' } })
    expect(f.calls).toEqual([])
  })
})
