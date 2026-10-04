import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import type { AddonId } from '@/lib/plans/ladder'
import { cancelPlanAtPeriodEnd, changeAddon, pendingPlanChange, resumeSubscription, RESUME_REMOVE_ADDONS_META, RESUME_REMOVE_AT_META } from './change-plan'
import { createStripeSim, SIM_PRICE_ID, type StripeSim } from '../../../test/stripe-addon-sim'
import { memRemovalOwedStore } from '../../../test/removal-owed-mem'
import { healOwedRemovals, recordRemovalOwed, type RemovalOwedInput } from './addon-removal-owed'

/**
 * Vera M-1 (QA report e3edb88), Aria Oct 4 9:28 AM CT: turning an add-on off, then canceling, then
 * resuming used to lose the planned removal (the cancel releases the schedule), so the add-on renewed at
 * full price. Now the cancel remembers it and the resume puts it back; if it can't, the resume is undone.
 * Simulated clock + schedules (test/stripe-addon-sim.ts), no real Stripe (team rules 9:03 and 9:29).
 */
const T0 = Math.floor(new Date('2026-10-04T14:00:00Z').getTime() / 1000)
const START = T0 - 10 * 86_400
const END = START + 30 * 86_400
type Sub = Parameters<typeof changeAddon>[1]

function setup() {
  const sim = createStripeSim({ nowSec: T0 })
  sim.addCustomer('cus_1')
  sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', addons: ['small_edit', 'big_change'], periodStart: START })
  return sim
}
const deps = (sim: StripeSim, stripe: unknown = sim.client()) => ({ stripe: stripe as Stripe, addonPriceIdFor: async (id: AddonId) => SIM_PRICE_ID.addon(id), now: sim.now, log: () => {} })
const live = (sim: StripeSim) => sim.sub('sub_1') as unknown as Sub
const addonsOn = (sim: StripeSim) => sim.sub('sub_1').items.data.filter((i) => i.price.id.startsWith('price_addon_')).map((i) => i.price.id.replace('price_addon_', ''))
const renewals = (sim: StripeSim) => sim.invoices().filter((i) => i.billing_reason === 'subscription_cycle')

async function turnOffBigChangeThenCancel(sim: StripeSim) {
  expect(await changeAddon(deps(sim), live(sim), 'big_change', 'off')).toMatchObject({ ok: true, kind: 'removal_scheduled', effectiveAt: new Date(END * 1000).toISOString() })
  expect(await pendingPlanChange(sim.client() as unknown as Stripe, live(sim), sim.now())).toMatchObject({ isSwitch: false, removedAddons: ['big_change'] })
  const c = await cancelPlanAtPeriodEnd(sim.client() as unknown as Stripe, live(sim), sim.now())
  expect(c).toMatchObject({ ok: true, kind: 'canceled', clearedPendingChange: { removedAddons: ['big_change'] } })
  // Stripe refuses a cancel while a schedule is attached: it was released, and the removal remembered
  expect(sim.sub('sub_1')).toMatchObject({ schedule: null, cancel_at_period_end: true })
  expect(sim.sub('sub_1').metadata).toEqual({ [RESUME_REMOVE_ADDONS_META]: 'big_change', [RESUME_REMOVE_AT_META]: String(END) })
}

describe('Vera M-1: a turned-off add-on can never renew, through off -> cancel -> resume', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('off, cancel, resume: the removal is back on the schedule; at the renewal Big change is gone and never billed', async () => {
    const sim = setup()
    await turnOffBigChangeThenCancel(sim)
    sim.advance(86_400)
    expect(await resumeSubscription(sim.client() as unknown as Stripe, live(sim), sim.now())).toEqual({ resumed: true, restoredRemoval: ['big_change'] })
    expect(sim.sub('sub_1')).toMatchObject({ cancel_at_period_end: false })
    expect(sim.sub('sub_1').metadata).toEqual({})
    // the Plans card shows "Ends <date>" again
    expect(await pendingPlanChange(sim.client() as unknown as Stripe, live(sim), sim.now())).toMatchObject({ isSwitch: false, removedAddons: ['big_change'], effectiveAt: new Date(END * 1000).toISOString() })
    sim.advance(25 * 86_400)
    expect(addonsOn(sim)).toEqual(['small_edit'])
    const [renewal] = renewals(sim)
    expect(renewal.lines.data.map((l) => l.price?.id)).toEqual([SIM_PRICE_ID.step('priority'), SIM_PRICE_ID.addon('small_edit')])
    expect(renewal.total).toBe(5500 + 500)
    // and the month after: still gone
    sim.advance(30 * 86_400)
    expect(renewals(sim).every((i) => !i.lines.data.some((l) => l.price?.id === SIM_PRICE_ID.addon('big_change')))).toBe(true)
  })

  it('off, cancel, no resume: the plan ends at the period end; nothing renews', async () => {
    const sim = setup()
    await turnOffBigChangeThenCancel(sim)
    sim.advance(26 * 86_400)
    expect(sim.sub('sub_1').status).toBe('canceled')
    expect(renewals(sim)).toHaveLength(0)
  })

  it('Aria 10:09 (option A): the removal cannot be put back (3 tries, 0.5 s / 1.5 s): the plan STAYS on, the removal is owed (flag + alert, source resume), the marker is cleared; the renewal refunds Big change once', async () => {
    const sim = setup()
    await turnOffBigChangeThenCancel(sim)
    const c = sim.client()
    let creates = 0
    const failing = { ...c, subscriptionSchedules: { ...c.subscriptionSchedules, create: async () => (creates++, Promise.reject(Object.assign(new Error('boom'), { type: 'StripeAPIError', statusCode: 500 }))) } }
    const { store, rows } = memRemovalOwedStore()
    const alerts: RemovalOwedInput[] = []
    const sleeps: number[] = []
    const logs: string[] = []
    const r = await resumeSubscription(failing as unknown as Stripe, live(sim), sim.now(), {
      userId: 'u1',
      sleep: async (ms) => void sleeps.push(ms),
      log: (m) => logs.push(m),
      onRemovalOwed: (o) => recordRemovalOwed({ store, alert: async (a) => void alerts.push(a), log: (m) => logs.push(m) }, o),
    })
    expect(r).toEqual({ resumed: true, restoredRemoval: [], removalOwed: ['big_change'] })
    expect(creates).toBe(3)
    expect(sleeps).toEqual([500, 1500])
    // the plan is back on; no draft-invoice stripping, nothing else touched
    expect(sim.sub('sub_1')).toMatchObject({ cancel_at_period_end: false, schedule: null })
    expect(sim.sub('sub_1').metadata[RESUME_REMOVE_ADDONS_META] ?? '').toBe('')
    const owed = { subscriptionId: 'sub_1', customerId: 'cus_1', userId: 'u1', addons: ['big_change'], effectiveAt: new Date(END * 1000).toISOString() }
    expect(alerts).toEqual([owed])
    expect(rows).toEqual([expect.objectContaining({ ...owed, clearedHow: null })])
    expect(logs.some((l) => l.includes('REMOVAL OWED on sub_1: big_change'))).toBe(true)
    // the renewal: Big change is still billed (Stripe had no removal) -> the L-1 self-heal removes it and refunds its line once
    sim.advance(26 * 86_400)
    const [renewal] = renewals(sim)
    expect(renewal.total).toBe(5500 + 500 + 575)
    const heal = await healOwedRemovals({ stripe: sim.client() as unknown as Stripe, store, log: () => {} }, renewal as unknown as Parameters<typeof healOwedRemovals>[1])
    expect(heal).toMatchObject({ outcome: 'refunded' })
    expect(sim.creditNotes).toEqual([expect.objectContaining({ invoice: renewal.id, amount: 575, memo: 'You turned off Big change, but it was still charged this period, so we refunded it.' })])
    expect(addonsOn(sim)).toEqual(['small_edit'])
    expect(rows[0]).toMatchObject({ clearedHow: 'refunded' })
    expect(await healOwedRemovals({ stripe: sim.client() as unknown as Stripe, store, log: () => {} }, renewal as unknown as Parameters<typeof healOwedRemovals>[1])).toMatchObject({ outcome: 'none' })
    expect(sim.creditNotes).toHaveLength(1)
  })

  it('succeeds on the 2nd try: the removal is back on the schedule, nothing owed', async () => {
    const sim = setup()
    await turnOffBigChangeThenCancel(sim)
    const c = sim.client()
    let left = 1
    const flaky = { ...c, subscriptionSchedules: { ...c.subscriptionSchedules, create: (p: Parameters<typeof c.subscriptionSchedules.create>[0]) => (left-- > 0 ? Promise.reject(new Error('boom')) : c.subscriptionSchedules.create(p)) } }
    const { store, rows } = memRemovalOwedStore()
    const r = await resumeSubscription(flaky as unknown as Stripe, live(sim), sim.now(), { sleep: async () => {}, log: () => {}, onRemovalOwed: (o) => recordRemovalOwed({ store, alert: async () => {}, log: () => {} }, o) })
    expect(r).toEqual({ resumed: true, restoredRemoval: ['big_change'] })
    expect(rows).toEqual([])
    sim.advance(26 * 86_400)
    expect(addonsOn(sim)).toEqual(['small_edit'])
  })

  it('the owed flag cannot be saved either: the resume is undone (set to end again) and reported as failed; the next Resume works', async () => {
    const sim = setup()
    await turnOffBigChangeThenCancel(sim)
    const c = sim.client()
    const failing = { ...c, subscriptionSchedules: { ...c.subscriptionSchedules, create: async () => Promise.reject(Object.assign(new Error('boom'), { type: 'StripeAPIError', statusCode: 500 })) } }
    const broken = { save: async () => Promise.reject(new Error('db down')), open: async () => [], clear: async () => {}, keep: async () => {} }
    await expect(
      resumeSubscription(failing as unknown as Stripe, live(sim), sim.now(), { sleep: async () => {}, log: () => {}, onRemovalOwed: (o) => recordRemovalOwed({ store: broken, alert: async () => Promise.reject(new Error('mail down')), log: () => {} }, o) })
    ).rejects.toThrow('boom')
    expect(sim.sub('sub_1')).toMatchObject({ cancel_at_period_end: true })
    expect(sim.sub('sub_1').metadata[RESUME_REMOVE_ADDONS_META]).toBe('big_change') // kept for the next try
    // no recorder at all: same safe undo
    await expect(resumeSubscription(failing as unknown as Stripe, live(sim), sim.now(), { sleep: async () => {}, log: () => {} })).rejects.toThrow('boom')
    expect(sim.sub('sub_1')).toMatchObject({ cancel_at_period_end: true })
    // the next Resume works
    expect(await resumeSubscription(sim.client() as unknown as Stripe, live(sim), sim.now())).toMatchObject({ resumed: true, restoredRemoval: ['big_change'] })
    sim.advance(26 * 86_400)
    expect(addonsOn(sim)).toEqual(['small_edit'])
  })

  it('a cancel with no add-on removal pending: resume is the old single update (no schedule, no metadata)', async () => {
    const sim = setup()
    await cancelPlanAtPeriodEnd(sim.client() as unknown as Stripe, live(sim), sim.now())
    expect(sim.sub('sub_1').metadata).toEqual({})
    const before = sim.log.length
    expect(await resumeSubscription(sim.client() as unknown as Stripe, live(sim), sim.now())).toEqual({ resumed: true, restoredRemoval: [] })
    expect(sim.log.slice(before)).toEqual(['subscriptions.update'])
    sim.advance(26 * 86_400)
    expect(addonsOn(sim)).toEqual(['small_edit', 'big_change'])
  })

  it('a stale marker (another period) is cleared, never applied', async () => {
    const sim = setup()
    await turnOffBigChangeThenCancel(sim)
    await sim.client().subscriptions.update('sub_1', { metadata: { [RESUME_REMOVE_AT_META]: String(END - 30 * 86_400) } })
    expect(await resumeSubscription(sim.client() as unknown as Stripe, live(sim), sim.now())).toEqual({ resumed: true, restoredRemoval: [] })
    expect(sim.sub('sub_1').metadata).toEqual({})
    expect(sim.sub('sub_1').schedule).toBeNull()
  })
})
