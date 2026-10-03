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
