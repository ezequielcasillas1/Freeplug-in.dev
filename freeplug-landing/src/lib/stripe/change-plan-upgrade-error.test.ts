// @vitest-environment node
// Phase 4 M-1 (Vera's base-p4 repro, ported): an upgrade that fails after releasing a pending downgrade or
// add-on removal must put it back on EVERY error path, and record + alert when the put-back fails. Mocks only.
import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { PLAN_STEPS, type PlanStepId } from '@/lib/plans/ladder'
import { changePlanStep, type PendingRestoreFailed } from '@/lib/stripe/change-plan'

const step = (id: PlanStepId) => PLAN_STEPS.find((s) => s.id === id)!
const NOW = new Date('2026-10-03T17:00:00Z')
const NOW_S = Math.floor(NOW.getTime() / 1000)
const PERIOD_END = 1_793_726_938
const sub = {
  id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false, cancel_at: null, schedule: 'sub_sched_0',
  items: { data: [{ id: 'si_1', quantity: 1, price: { id: 'price_priority', lookup_key: step('priority').lookupKey, unit_amount: 5500, recurring: { interval: 'month' } } }] },
} as unknown as Stripe.Subscription

const subWithAddon = {
  ...sub,
  items: { data: [...(sub.items.data as unknown[]), { id: 'si_2', quantity: 1, price: { id: 'price_addon_small_edit', lookup_key: 'freeplug_addon_small_edit_monthly', unit_amount: 575, recurring: { interval: 'month' } } }] },
} as unknown as Stripe.Subscription

function fake(err: Error | null, opts: { restoreFails?: boolean; updateGate?: Promise<void>; addonRemoval?: boolean } = {}) {
  const calls: string[] = []
  const s = {
    subscriptions: {
      update: vi.fn(async () => {
        calls.push('subscriptions.update')
        if (opts.updateGate) await opts.updateGate
        if (err) throw err
        return { ...sub, schedule: null, pending_update: null, latest_invoice: { id: 'in_1', status: 'paid' } }
      }),
      retrieve: vi.fn(async () => ({ ...sub, schedule: null })),
    },
    invoices: { voidInvoice: vi.fn() },
    prices: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        lookup_key: id.startsWith('price_addon_') ? `freeplug_addon_${id.replace('price_addon_', '')}_monthly` : `freeplug_step_${id.replace('price_', '')}_monthly`,
      })),
    },
    subscriptionSchedules: {
      create: vi.fn(async () => {
        calls.push('schedules.create')
        if (opts.restoreFails) throw new Error('schedule create down')
        return { id: 'sub_sched_1', status: 'active', current_phase: { start_date: NOW_S - 86400, end_date: PERIOD_END }, phases: [{ start_date: NOW_S - 86400, end_date: PERIOD_END, items: [{ price: 'price_priority', quantity: 1 }] }] }
      }),
      retrieve: vi.fn(async () => (calls.push('schedules.retrieve'), {
        id: 'sub_sched_0', status: 'active', current_phase: { start_date: NOW_S - 86400, end_date: PERIOD_END },
        phases: [
          { start_date: NOW_S - 86400, end_date: PERIOD_END, items: [{ price: 'price_priority', quantity: 1 }], metadata: {} },
          opts.addonRemoval
            ? { start_date: PERIOD_END, end_date: PERIOD_END + 2592000, items: [{ price: 'price_priority', quantity: 1 }], metadata: { plan_step: 'priority', plan_change: 'addons' } }
            : { start_date: PERIOD_END, end_date: PERIOD_END + 2592000, items: [{ price: 'price_starter', quantity: 1 }], metadata: { plan_step: 'starter' } },
        ],
      })),
      update: vi.fn(async () => {
        calls.push('schedules.update')
        if (opts.restoreFails) throw new Error('schedule update down')
        return {}
      }),
      release: vi.fn(async () => (calls.push('schedules.release'), {})),
    },
  }
  return { stripe: s as unknown as Stripe, calls }
}
const priceIdFor = async (id: PlanStepId) => `price_${id}`
const restored = (calls: string[]) => calls.slice(calls.indexOf('subscriptions.update') + 1).some((c) => c.startsWith('schedules.'))

describe('Phase 4 M-1: upgrade error after releasing a pending downgrade', () => {
  it.each([
    ['StripeAPIError', { type: 'StripeAPIError' }],
    ['StripeConnectionError', { type: 'StripeConnectionError' }],
    ['rate limit', { type: 'StripeRateLimitError', code: 'rate_limit' }],
  ])('%s: the pending downgrade is put back, then the error is thrown', async (_n, extra) => {
    const f = fake(Object.assign(new Error('boom'), extra))
    const onRestoreFailed = vi.fn(async (_o: PendingRestoreFailed) => {})
    await expect(changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW, log: () => {}, onRestoreFailed }, sub, 'fast_lane')).rejects.toThrow('boom')
    expect(f.calls.slice(0, 3)).toEqual(['schedules.retrieve', 'schedules.release', 'subscriptions.update'])
    expect(restored(f.calls)).toBe(true)
    expect(onRestoreFailed).not.toHaveBeenCalled()
  })

  it('card error: put back, payment_failed with pendingRestored true', async () => {
    const f = fake(Object.assign(new Error('declined'), { type: 'StripeCardError' }))
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW, log: () => {} }, sub, 'fast_lane')
    expect(r).toMatchObject({ ok: false, code: 'payment_failed', pendingRestored: true })
    expect(restored(f.calls)).toBe(true)
  })

  it('the put-back fails too: never silent (logged + admin alert naming the lost downgrade), error still thrown', async () => {
    const f = fake(Object.assign(new Error('boom'), { type: 'StripeAPIError' }), { restoreFails: true })
    const onRestoreFailed = vi.fn(async (_o: PendingRestoreFailed) => {})
    const logs: string[] = []
    await expect(changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW, log: (m) => logs.push(m), onRestoreFailed, sleep: async () => {} }, sub, 'fast_lane', { userId: 'u1' })).rejects.toThrow('boom')
    expect(onRestoreFailed).toHaveBeenCalledTimes(1)
    expect(onRestoreFailed.mock.calls[0][0]).toMatchObject({ subscriptionId: 'sub_1', customerId: 'cus_1', userId: 'u1', pendingStep: 'starter', upgradeError: 'boom', removalOwedSaved: null })
    expect(logs.join('\n')).toMatch(/PENDING CHANGE LOST on sub_1/)
  })

  it('the put-back fails on a card error: pendingRestored false and the alert still goes out', async () => {
    const f = fake(Object.assign(new Error('declined'), { type: 'StripeCardError' }), { restoreFails: true })
    const onRestoreFailed = vi.fn(async (_o: PendingRestoreFailed) => {})
    const r = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW, log: () => {}, onRestoreFailed }, sub, 'fast_lane')
    expect(r).toMatchObject({ ok: false, code: 'payment_failed', pendingRestored: false })
    expect(onRestoreFailed).toHaveBeenCalledTimes(1)
  })

  it('a pending add-on removal that cannot be put back is recorded as OWED (flag + alert) and alerted as lost', async () => {
    const f = fake(Object.assign(new Error('boom'), { type: 'StripeAPIError' }), { restoreFails: true, addonRemoval: true })
    const onRemovalOwed = vi.fn(async (_o: unknown) => ({ saved: true, alerted: true }))
    const onRestoreFailed = vi.fn(async (_o: PendingRestoreFailed) => {})
    await expect(changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW, log: () => {}, onRemovalOwed, onRestoreFailed }, subWithAddon, 'fast_lane', { userId: 'u1' })).rejects.toThrow('boom')
    expect(onRemovalOwed).toHaveBeenCalledWith({ subscriptionId: 'sub_1', customerId: 'cus_1', userId: 'u1', addons: ['small_edit'], effectiveAt: new Date(PERIOD_END * 1000).toISOString() })
    expect(onRestoreFailed.mock.calls[0][0]).toMatchObject({ pendingStep: 'priority', addonsTurnedOff: ['small_edit'], removalOwedSaved: true })
  })

  it('the alert itself failing is logged, not thrown over the original error', async () => {
    const f = fake(Object.assign(new Error('boom'), { type: 'StripeAPIError' }), { restoreFails: true })
    const logs: string[] = []
    await expect(changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW, log: (m) => logs.push(m), onRestoreFailed: async () => { throw new Error('mail down') } }, sub, 'fast_lane')).rejects.toThrow('boom')
    expect(logs.join('\n')).toMatch(/PENDING CHANGE LOST ALERT FAILED on sub_1: mail down/)
  })

  it('"already in progress": a second identical upgrade returns before anything is released', async () => {
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    const f = fake(null, { updateGate: gate })
    const first = changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW, log: () => {} }, sub, 'fast_lane', { userId: 'u1' })
    await vi.waitFor(() => expect(f.calls).toContain('subscriptions.update'))
    const before = [...f.calls]
    const second = await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW, log: () => {} }, sub, 'fast_lane', { userId: 'u1' })
    expect(second).toMatchObject({ ok: false, code: 'in_progress' })
    expect(f.calls).toEqual(before) // nothing retrieved, released or updated by the second call
    open()
    expect(await first).toMatchObject({ ok: true, kind: 'upgraded' })
  })

  it('idempotency_key_in_use from Stripe (another isolate): in_progress, no put-back over the other request, but alerted', async () => {
    const f = fake(Object.assign(new Error('in use'), { code: 'idempotency_key_in_use' }))
    const onRestoreFailed = vi.fn(async (_o: PendingRestoreFailed) => {})
    expect(await changePlanStep({ stripe: f.stripe, priceIdFor, now: () => NOW, log: () => {}, onRestoreFailed }, sub, 'fast_lane')).toMatchObject({ ok: false, code: 'in_progress' })
    expect(restored(f.calls)).toBe(false)
    expect(onRestoreFailed).toHaveBeenCalledTimes(1)
    expect(onRestoreFailed.mock.calls[0]![0].upgradeError).toMatch(/idempotency_key_in_use/)
  })
})
