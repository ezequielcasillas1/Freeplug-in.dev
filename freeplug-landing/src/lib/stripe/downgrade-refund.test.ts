// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { PLAN_STEPS, type PlanStepId } from '@/lib/plans/ladder'
import { isRefundDowngrade } from '@/lib/plans/downgrade-refund-rule'
import { changePlanStep } from './change-plan'
import { DOWNGRADE_REFUND_KIND, findDowngradeRefund } from './downgrade-refund'
import { downgradeRefundAlert } from './downgrade-refund-alert'

const step = (id: PlanStepId) => PLAN_STEPS.find((s) => s.id === id)!
const priceItem = (id: string, cents: number, lookup: string | null, siId = 'si_1') => ({ id: siId, quantity: 1, price: { id, lookup_key: lookup, unit_amount: cents, recurring: { interval: 'month' } } })
const sub = (id: PlanStepId, extra: unknown[] = []) =>
  ({
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    schedule: null,
    items: { data: [priceItem(`price_${id}`, step(id).monthlyCents, step(id).lookupKey), ...extra] },
  }) as unknown as Stripe.Subscription

type Opts = { invoices?: unknown[]; amountRefunded?: number; existing?: unknown[]; refundFails?: boolean; updateFails?: boolean; balanceTxns?: unknown[] }
function fakeStripe(o: Opts = {}) {
  const refundsCreated: { params: Record<string, unknown>; key?: string }[] = []
  const stripe = {
    invoices: { list: vi.fn(async () => ({ data: o.invoices ?? [{ id: 'in_100', amount_paid: 10000, charge: 'ch_100' }] })) },
    invoicePayments: { list: vi.fn(async () => ({ data: [] })) },
    paymentIntents: { retrieve: vi.fn() },
    charges: { retrieve: vi.fn(async (id: string) => ({ id, amount: 10000, amount_refunded: o.amountRefunded ?? 0, refunded: false })) },
    refunds: {
      list: vi.fn(async () => ({ data: o.existing ?? [] })),
      create: vi.fn(async (params: Record<string, unknown>, opts?: { idempotencyKey?: string }) => {
        refundsCreated.push({ params, key: opts?.idempotencyKey })
        if (o.refundFails) throw new Error('refund declined')
        return { id: 're_1', amount: params.amount }
      }),
    },
    customers: {
      listBalanceTransactions: vi.fn(async () => ({ data: o.balanceTxns ?? [] })),
      createBalanceTransaction: vi.fn(async (customer: string, params: Record<string, unknown>, opts?: { idempotencyKey?: string }) => {
        refundsCreated.push({ params: { customer, ...params }, key: opts?.idempotencyKey })
        if (o.refundFails) throw new Error('credit declined')
        return { id: 'cbtxn_1', amount: params.amount }
      }),
    },
    subscriptions: {
      update: vi.fn(async (id: string) => {
        if (o.updateFails) throw new Error('update failed')
        return { id }
      }),
    },
    subscriptionSchedules: {
      create: vi.fn(async () => ({ id: 'sched_new', current_phase: { start_date: 1, end_date: 2_000_000_000 }, phases: [{ start_date: 1, end_date: 2_000_000_000, items: [] }] })),
      update: vi.fn(async () => ({ id: 'sched_new', phases: [{ start_date: 1, end_date: 2_000_000_000 }, { start_date: 2_000_000_000 }] })),
      retrieve: vi.fn(),
      release: vi.fn(),
    },
  }
  return { stripe: stripe as unknown as Stripe, raw: stripe, refundsCreated }
}
const deps = (stripe: Stripe, extra: Record<string, unknown> = {}) => ({ stripe, priceIdFor: async (id: PlanStepId) => `price_${id}`, log: () => {}, now: () => new Date('2026-10-23T16:40:00Z'), ...extra })

describe('isRefundDowngrade (eligibility)', () => {
  it('is true only for $100 growth -> $35 starter', () => {
    expect(isRefundDowngrade(step('growth'), 10000, step('starter'))).toBe(true)
  })
  it.each(['priority', 'fast_lane', 'leads', 'get_found'] as PlanStepId[])('100 -> %s is not eligible', (t) => {
    expect(isRefundDowngrade(step('growth'), 10000, step(t))).toBe(false)
  })
  it.each(['priority', 'fast_lane', 'leads', 'get_found'] as PlanStepId[])('%s -> starter is not eligible', (f) => {
    expect(isRefundDowngrade(step(f), step(f).monthlyCents, step('starter'))).toBe(false)
  })
  it('needs the plan price to be exactly $100 (grandfathered/legacy or odd price = no)', () => {
    expect(isRefundDowngrade(null, 10000, step('starter'))).toBe(false)
    expect(isRefundDowngrade(step('growth'), 9900, step('starter'))).toBe(false)
    expect(isRefundDowngrade({ id: 'growth', monthlyCents: 9000 }, 10000, step('starter'))).toBe(false)
  })
  it('matches ids, not names', () => {
    expect(isRefundDowngrade({ id: 'growth', monthlyCents: 10000 }, 10000, { id: 'starter', monthlyCents: 3500 })).toBe(true)
  })
})

describe('changePlanStep: $100 -> $35 refund path', () => {
  it('wallet choice: $50 credit on the Freeplug wallet (customer balance), no card refund, switches now', async () => {
    const { stripe, raw, refundsCreated } = fakeStripe()
    const onDowngradeRefund = vi.fn(async () => {})
    const r = await changePlanStep(deps(stripe, { onDowngradeRefund }), sub('growth'), 'starter', { userId: 'u1', creditChoice: 'wallet' })
    expect(r).toEqual({ ok: true, kind: 'downgraded_refunded', step: 'starter', refundCents: 5000, refundId: 'cbtxn_1', invoiceId: 'in_100', choice: 'wallet' })
    expect(raw.refunds.create).not.toHaveBeenCalled()
    expect(refundsCreated).toHaveLength(1)
    expect(refundsCreated[0].params).toMatchObject({ customer: 'cus_1', amount: -5000, currency: 'usd', metadata: { kind: DOWNGRADE_REFUND_KIND, choice: 'wallet', subscription: 'sub_1', invoice: 'in_100' } })
    expect(refundsCreated[0].key).toBe('downgrade-refund:sub_1:in_100')
    expect(raw.subscriptions.update).toHaveBeenCalledWith('sub_1', expect.objectContaining({ billing_cycle_anchor: 'now', proration_behavior: 'none', items: [{ id: 'si_1', price: 'price_starter', quantity: 1 }], metadata: { downgrade_credit_choice: 'wallet', downgrade_credit_invoice: 'in_100' } }), { idempotencyKey: 'downgrade-now:sub_1:in_100' })
    expect(raw.subscriptionSchedules.create).not.toHaveBeenCalled()
    expect(onDowngradeRefund).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'done', refundCents: 5000, choice: 'wallet' }))
  })

  it('buyout choice: no money moves (no refund, no credit); the switch records the choice', async () => {
    const { stripe, raw } = fakeStripe()
    const onDowngradeRefund = vi.fn(async () => {})
    const r = await changePlanStep(deps(stripe, { onDowngradeRefund }), sub('growth'), 'starter', { userId: 'u1', creditChoice: 'buyout' })
    expect(r).toMatchObject({ ok: true, kind: 'downgraded_refunded', refundCents: 5000, refundId: null, choice: 'buyout' })
    expect(raw.refunds.create).not.toHaveBeenCalled()
    expect(raw.customers.createBalanceTransaction).not.toHaveBeenCalled()
    expect(raw.subscriptions.update).toHaveBeenCalledWith('sub_1', expect.objectContaining({ metadata: { downgrade_credit_choice: 'buyout', downgrade_credit_invoice: 'in_100' } }), expect.anything())
    expect(onDowngradeRefund).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'done', choice: 'buyout' }))
  })

  it('no choice sent = buyout (default)', async () => {
    const { stripe, raw } = fakeStripe()
    const r = await changePlanStep(deps(stripe), sub('growth'), 'starter')
    expect(r).toMatchObject({ kind: 'downgraded_refunded', choice: 'buyout' })
    expect(raw.customers.createBalanceTransaction).not.toHaveBeenCalled()
  })

  it('caps the credit at the amount paid', async () => {
    const { stripe, refundsCreated } = fakeStripe({ invoices: [{ id: 'in_c', amount_paid: 3000, charge: 'ch_c' }] })
    const r = await changePlanStep(deps(stripe), sub('growth'), 'starter', { creditChoice: 'wallet' })
    expect(r).toMatchObject({ kind: 'downgraded_refunded', refundCents: 3000 })
    expect(refundsCreated[0].params.amount).toBe(-3000)
  })

  it('wallet retry after a failed switch: credit already on the balance, not added twice', async () => {
    const balanceTxns = [{ id: 'cbtxn_old', amount: -5000, metadata: { kind: DOWNGRADE_REFUND_KIND, subscription: 'sub_1', invoice: 'in_100' } }]
    const { stripe, raw } = fakeStripe({ balanceTxns })
    const r = await changePlanStep(deps(stripe), sub('growth'), 'starter', { creditChoice: 'wallet' })
    expect(raw.customers.createBalanceTransaction).not.toHaveBeenCalled()
    expect(r).toMatchObject({ kind: 'downgraded_refunded', refundId: 'cbtxn_old' })
  })

  it('drops the tip item on the switch (a plan change resets the tip)', async () => {
    const { stripe, raw } = fakeStripe()
    const tip = { id: 'si_tip', quantity: 5, price: { id: 'price_tip', lookup_key: 'freeplug_tip_monthly', unit_amount: 100, recurring: { interval: 'month' } } }
    await changePlanStep(deps(stripe), sub('growth', [tip]), 'starter')
    const items = (raw.subscriptions.update.mock.calls[0] as unknown[])[1] as { items: { id: string; deleted?: boolean }[] }
    expect(items.items.some((i) => i.id === 'si_tip' && i.deleted)).toBe(true)
  })

  it.each([
    ['no paid invoice', { invoices: [] }],
    ['$0 invoice', { invoices: [{ id: 'in_0', amount_paid: 0, charge: null }] }],
    ['charge already refunded', { amountRefunded: 1000 }],
    ['wallet credit call fails', { refundFails: true }],
  ] as [string, Opts][])('%s: falls back to the normal deferred downgrade, no switch now', async (_n, o) => {
    const { stripe, raw } = fakeStripe(o)
    const log = vi.fn()
    const r = await changePlanStep(deps(stripe, { log }), sub('growth'), 'starter', { creditChoice: 'wallet' })
    expect(r).toMatchObject({ ok: true, kind: 'scheduled', step: 'starter' })
    expect(raw.subscriptions.update).not.toHaveBeenCalled()
    expect(raw.subscriptionSchedules.create).toHaveBeenCalled()
    expect(log).toHaveBeenCalled()
  })

  it('credit ok but switch fails: alerted, refund_switch_failed', async () => {
    const { stripe } = fakeStripe({ updateFails: true })
    const onDowngradeRefund = vi.fn(async () => {})
    const r = await changePlanStep(deps(stripe, { onDowngradeRefund }), sub('growth'), 'starter', { creditChoice: 'wallet' })
    expect(r).toMatchObject({ ok: false, code: 'refund_switch_failed', refundCents: 5000 })
    expect(onDowngradeRefund).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'switch_failed' }))
  })

  it('other downgrades are unchanged: 100 -> 55 and 65 -> 35 are deferred, no refund', async () => {
    for (const [from, to] of [['growth', 'priority'], ['fast_lane', 'starter']] as [PlanStepId, PlanStepId][]) {
      const { stripe, raw } = fakeStripe()
      const r = await changePlanStep(deps(stripe), sub(from), to)
      expect(r).toMatchObject({ kind: 'scheduled', step: to })
      expect(raw.refunds.create).not.toHaveBeenCalled()
      expect(raw.invoices.list).not.toHaveBeenCalled()
    }
  })
})

describe('findDowngradeRefund', () => {
  it('ignores someone else\'s refund metadata and treats any refund as already refunded', async () => {
    const { stripe } = fakeStripe({ existing: [{ id: 're_x', amount: 100, status: 'succeeded', metadata: {} }], amountRefunded: 100 })
    expect(await findDowngradeRefund(stripe, 'sub_1')).toEqual({ skip: 'already_refunded' })
  })
})

describe('downgradeRefundAlert', () => {
  it('names the subscription, invoice and amount', () => {
    const a = downgradeRefundAlert({ subscriptionId: 'sub_1', userId: 'u1', invoiceId: 'in_1', chargeId: 'ch_1', refundId: 're_1', refundCents: 5000, outcome: 'done', choice: 'wallet' })
    expect(a.subject).toContain('$50.00')
    expect(a.text).toContain('in_1')
  })
})
