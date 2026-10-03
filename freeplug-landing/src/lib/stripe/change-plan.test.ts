// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { PLAN_STEPS, type PlanStepId } from '@/lib/plans/ladder'
import { changePlanStep, planMove, subscriptionMonthlyCents } from './change-plan'

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

function fakeStripe(opts: { pendingUpdate?: boolean } = {}) {
  const calls: string[] = []
  const stripe = {
    subscriptions: {
      update: vi.fn(async (id: string) => {
        calls.push('subscriptions.update')
        return { id, pending_update: opts.pendingUpdate ? { expires_at: 1 } : null, latest_invoice: { status: opts.pendingUpdate ? 'open' : 'paid' } }
      }),
    },
    subscriptionSchedules: {
      create: vi.fn(async () => {
        calls.push('schedules.create')
        return { id: 'sub_sched_1', current_phase: { start_date: 1_790_000_000, end_date: 1_792_600_000 }, phases: [{ start_date: 1_790_000_000, end_date: 1_792_600_000, items: [{ price: 'price_leads', quantity: 1 }] }] }
      }),
      retrieve: vi.fn(async () => ({ id: 'sub_sched_0', current_phase: { start_date: 1, end_date: 2 }, phases: [{ start_date: 1, end_date: 2, items: [{ price: 'price_leads', quantity: 1 }] }] })),
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
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter'), 'leads')
    expect(r).toEqual({ ok: true, kind: 'upgraded', step: 'leads', invoiceStatus: 'paid' })
    const [id, params, opts] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams, { idempotencyKey: string }]
    expect(id).toBe('sub_1')
    expect(params).toMatchObject({ items: [{ id: 'si_1', price: 'price_leads', quantity: 1 }], proration_behavior: 'always_invoice', payment_behavior: 'pending_if_incomplete' })
    expect(opts.idempotencyKey).toBe('plan-move:sub_1:price_starter:leads')
    expect(f.raw.subscriptionSchedules.create).not.toHaveBeenCalled()
  })

  it('upgrade with a failed card: Stripe keeps the old plan (pending update) and we say so', async () => {
    const f = fakeStripe({ pendingUpdate: true })
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter'), 'growth')).toMatchObject({ ok: false, code: 'payment_failed' })
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
    await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('leads', { schedule: 'sub_sched_0' }), 'growth')
    expect(f.calls).toEqual(['schedules.release', 'subscriptions.update'])
  })

  it('a grandfathered plan moves only when the customer picks a step: all old items are replaced on upgrade', async () => {
    const f = fakeStripe()
    await changePlanStep({ stripe: f.stripe, priceIdFor }, legacySub(4000, 1500), 'growth')
    const [, params] = f.raw.subscriptions.update.mock.calls[0] as unknown as [string, Stripe.SubscriptionUpdateParams]
    expect(params.items).toEqual([{ id: 'si_h', price: 'price_growth', quantity: 1 }, { id: 'si_a', deleted: true }])
  })

  it('refuses an ending or ended plan, and a missing price, without writing anything', async () => {
    const f = fakeStripe()
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter', { cancel_at_period_end: true }), 'leads')).toMatchObject({ code: 'ending' })
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor }, ladderSub('starter', { status: 'canceled' }), 'leads')).toMatchObject({ code: 'not_live' })
    expect(
      await changePlanStep({ stripe: f.stripe, priceIdFor: async () => { throw new Error('no price') } }, ladderSub('starter'), 'leads')
    ).toMatchObject({ code: 'price' })
    expect(f.calls).toEqual([])
  })
})
