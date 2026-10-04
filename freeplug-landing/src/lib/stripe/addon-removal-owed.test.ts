import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import type { AddonId, PlanStepId } from '@/lib/plans/ladder'
import { changeAddon, changePlanStep, refundAddonCharge } from './change-plan'
import { ADDON_REFUNDED_META } from './addon-refund-info'
import { healOwedRemovals, recordRemovalOwed, removalOwedAlert, REMOVAL_RESCHEDULE_BACKOFF_MS, REMOVAL_RESCHEDULE_TRIES, type RemovalOwedInput } from './addon-removal-owed'
import { createStripeSim, SIM_PRICE_ID, type StripeSim } from '../../../test/stripe-addon-sim'
import { memRemovalOwedStore } from '../../../test/removal-owed-mem'

/**
 * L-1 (Aria, Oct 4 9:57 AM CT): a customer must never be charged for an add-on they turned off. An upgrade
 * releases the schedule holding the removal; putting it back is retried 3 times with backoff; still failing =
 * the removal is OWED (flag on our side + internal alert), and the renewal's invoice.paid self-heal removes
 * the item and refunds its line exactly once, then clears the flag. Simulated Stripe (no test-mode writes).
 */
const T0 = Math.floor(new Date('2026-10-04T14:00:00Z').getTime() / 1000)
const START = T0 - 10 * 86_400
const END = START + 30 * 86_400
const USER = '11111111-2222-4333-8444-555555555555'
type Sub = Parameters<typeof changeAddon>[1]

function setup() {
  const sim = createStripeSim({ nowSec: T0 })
  sim.addCustomer('cus_1')
  sim.addSub({ id: 'sub_1', customer: 'cus_1', step: 'priority', addons: ['small_edit', 'big_change'], periodStart: START })
  return sim
}
const live = (sim: StripeSim) => sim.sub('sub_1') as unknown as Sub
const addonsOn = (sim: StripeSim) => sim.sub('sub_1').items.data.filter((i) => i.price.id.startsWith('price_addon_')).map((i) => i.price.id.replace('price_addon_', ''))
const renewals = (sim: StripeSim) => sim.invoices().filter((i) => i.billing_reason === 'subscription_cycle')
const addonDeps = (sim: StripeSim) => ({ stripe: sim.client() as unknown as Stripe, addonPriceIdFor: async (id: AddonId) => SIM_PRICE_ID.addon(id), now: sim.now, log: () => {} })

/** Schedule create/update fail `failTimes` times (Stripe 500s); everything else is the sim. */
function flaky(sim: StripeSim, failTimes: number) {
  const c = sim.client()
  const calls = { create: 0, update: 0 }
  let left = failTimes
  const boom = () => Promise.reject(Object.assign(new Error('stripe 500 (simulated)'), { type: 'StripeAPIError', statusCode: 500 }))
  const client = {
    ...c,
    subscriptionSchedules: {
      ...c.subscriptionSchedules,
      create: (p: Parameters<typeof c.subscriptionSchedules.create>[0]) => (calls.create++, left-- > 0 ? boom() : c.subscriptionSchedules.create(p)),
      update: (id: string, p: Parameters<typeof c.subscriptionSchedules.update>[1]) => (calls.update++, c.subscriptionSchedules.update(id, p)),
    },
  }
  return { client: client as unknown as Stripe, calls }
}

async function turnOffThenUpgrade(sim: StripeSim, failTimes: number) {
  expect(await changeAddon(addonDeps(sim), live(sim), 'big_change', 'off')).toMatchObject({ ok: true, kind: 'removal_scheduled' })
  const { client, calls } = flaky(sim, failTimes)
  const sleeps: number[] = []
  const logs: string[] = []
  const { store, rows } = memRemovalOwedStore()
  const alerts: RemovalOwedInput[] = []
  const r = await changePlanStep(
    {
      stripe: client,
      priceIdFor: async (id: PlanStepId) => SIM_PRICE_ID.step(id),
      now: sim.now,
      log: (m) => logs.push(m),
      sleep: async (ms) => void sleeps.push(ms),
      onRemovalOwed: (o) => recordRemovalOwed({ store, alert: async (a) => void alerts.push(a), log: (m) => logs.push(m) }, o),
    },
    live(sim),
    'fast_lane',
    { userId: USER }
  )
  return { r, calls, sleeps, logs, store, rows, alerts }
}

describe('L-1: the removal of a turned-off add-on survives an upgrade (retries, owed flag, alert, one refund)', () => {
  it('3 failed re-schedules: retried with backoff, then the flag is saved and we are alerted; the renewal refunds Big change exactly once and clears the flag', async () => {
    const sim = setup()
    const t = await turnOffThenUpgrade(sim, 99)
    expect(t.r).toMatchObject({ ok: true, kind: 'upgraded', step: 'fast_lane', addonRemovalKept: false, removalOwed: true })
    // retries: 3 tries, 0.5 s then 1.5 s between them
    expect(REMOVAL_RESCHEDULE_TRIES).toBe(3)
    expect(t.calls.create).toBe(3)
    expect(t.sleeps).toEqual([...REMOVAL_RESCHEDULE_BACKOFF_MS])
    expect(t.sleeps).toEqual([500, 1500])
    expect(t.logs.filter((m) => m.includes('re-schedule of the add-on removal on sub_1 failed'))).toHaveLength(3)
    // the flag (our side)
    expect(t.rows).toEqual([
      expect.objectContaining({ subscriptionId: 'sub_1', customerId: 'cus_1', userId: USER, addons: ['big_change'], effectiveAt: new Date(END * 1000).toISOString(), clearedHow: null }),
    ])
    // the internal alert (to us; stays unsent locally: the transport is the spy here)
    expect(t.alerts).toHaveLength(1)
    expect(removalOwedAlert(t.alerts[0]).subject).toBe('[Freeplug billing] Add-on removal owed on sub_1')
    expect(removalOwedAlert(t.alerts[0]).text).toContain('Add-ons the customer turned off: big_change')
    // Stripe doesn't hold the removal: the renewal bills Big change
    expect(sim.sub('sub_1').schedule).toBeNull()
    sim.advance(21 * 86_400)
    const [renewal] = renewals(sim)
    expect(renewal.lines.data.map((l) => l.price?.id)).toContain(SIM_PRICE_ID.addon('big_change'))
    expect(renewal).toMatchObject({ total: 6500 + 500 + 575, amount_paid: 6500 + 500 + 575 })
    // invoice.paid self-heal
    const notified: string[] = []
    const deps = { stripe: sim.client() as unknown as Stripe, store: t.store, log: () => {}, notifyRefund: async (id: string) => void notified.push(id) }
    expect(await healOwedRemovals(deps, renewal)).toEqual({ outcome: 'refunded', invoiceId: renewal.id, addons: ['big_change'], cardCents: 575, creditCents: 0 })
    expect(addonsOn(sim)).toEqual(['small_edit'])
    expect(sim.creditNotes).toEqual([
      expect.objectContaining({ invoice: renewal.id, amount: 575, refund_amount: 575, credit_amount: 0, memo: 'You turned off Big change, but it was still charged this period.' }),
    ])
    expect(sim.invoice(renewal.id).metadata).toMatchObject({ addon_refunded: 'true', addon_refund_reason: 'turned_off', addon_turned_off_refunded: 'big_change', addon_refund_card_cents: '575', addon_refund_credit_cents: '0' })
    expect(t.rows[0]).toMatchObject({ clearedHow: 'refunded', clearedInvoiceId: renewal.id })
    expect(notified).toEqual([renewal.id])
    // a redelivery: flag already cleared, nothing more
    expect(await healOwedRemovals(deps, renewal)).toEqual({ outcome: 'none' })
    expect(sim.creditNotes).toHaveLength(1)
    // and the next month never bills it
    sim.advance(30 * 86_400)
    expect(renewals(sim)[1].lines.data.map((l) => l.price?.id)).not.toContain(SIM_PRICE_ID.addon('big_change'))
  })

  it('the flag clear fails after the refund: retry; the redelivery finds the refund (no second credit note) and clears the flag', async () => {
    const sim = setup()
    await changeAddon(addonDeps(sim), live(sim), 'big_change', 'off')
    const { store, rows } = memRemovalOwedStore({ failClearTimes: 1 })
    await store.save({ subscriptionId: 'sub_1', customerId: 'cus_1', userId: USER, addons: ['big_change'], effectiveAt: new Date(END * 1000).toISOString() })
    await sim.client().subscriptionSchedules.release(sim.sub('sub_1').schedule!) // what the failed upgrade left
    sim.advance(21 * 86_400)
    const [renewal] = renewals(sim)
    const deps = { stripe: sim.client() as unknown as Stripe, store, log: () => {} }
    expect(await healOwedRemovals(deps, renewal)).toMatchObject({ outcome: 'retry' })
    expect(rows[0].clearedHow).toBeNull()
    expect(await healOwedRemovals(deps, renewal)).toMatchObject({ outcome: 'already_refunded', cardCents: 575 })
    expect(sim.creditNotes).toHaveLength(1)
    expect(rows[0]).toMatchObject({ clearedHow: 'refunded', clearedInvoiceId: renewal.id })
  })

  it('the second try works: removal kept on the new step, no flag, no alert, one backoff', async () => {
    const sim = setup()
    const t = await turnOffThenUpgrade(sim, 1)
    expect(t.r).toMatchObject({ ok: true, kind: 'upgraded', addonRemovalKept: true })
    expect(t.r).not.toHaveProperty('removalOwed')
    expect(t.calls.create).toBe(2)
    expect(t.sleeps).toEqual([500])
    expect(t.rows).toEqual([])
    expect(t.alerts).toEqual([])
    sim.advance(21 * 86_400)
    expect(addonsOn(sim)).toEqual(['small_edit'])
    expect(renewals(sim)[0].lines.data.map((l) => l.price?.id)).not.toContain(SIM_PRICE_ID.addon('big_change'))
  })

  it('removed by hand before the renewal (nothing billed): the flag clears as not_billed, no refund, no email', async () => {
    const sim = setup()
    const { store, rows } = memRemovalOwedStore()
    await store.save({ subscriptionId: 'sub_1', customerId: 'cus_1', userId: USER, addons: ['big_change'], effectiveAt: new Date(END * 1000).toISOString() })
    const item = sim.sub('sub_1').items.data.find((i) => i.price.id === SIM_PRICE_ID.addon('big_change'))!
    await sim.client().subscriptions.update('sub_1', { items: [{ id: item.id, deleted: true }], proration_behavior: 'none' })
    sim.advance(21 * 86_400)
    const notified: string[] = []
    const r = await healOwedRemovals({ stripe: sim.client() as unknown as Stripe, store, log: () => {}, notifyRefund: async (id) => void notified.push(id) }, renewals(sim)[0])
    expect(r).toMatchObject({ outcome: 'not_billed', addons: [], cardCents: 0 })
    expect(sim.creditNotes).toEqual([])
    expect(notified).toEqual([])
    expect(rows[0].clearedHow).toBe('not_billed')
  })

  it('not due yet (a renewal before the owed date) and Keep it: nothing refunded; Keep clears the flag', async () => {
    const sim = setup()
    const { store, rows } = memRemovalOwedStore()
    await store.save({ subscriptionId: 'sub_1', customerId: 'cus_1', userId: USER, addons: ['big_change'], effectiveAt: new Date((END + 30 * 86_400) * 1000).toISOString() })
    sim.advance(21 * 86_400)
    expect(await healOwedRemovals({ stripe: sim.client() as unknown as Stripe, store, log: () => {} }, renewals(sim)[0])).toEqual({ outcome: 'not_due' })
    expect(sim.creditNotes).toEqual([])
    await store.keep('sub_1', 'big_change')
    expect(rows[0].clearedHow).toBe('kept')
  })

  it('the flag cannot be saved: reported as removalOwed false and logged loudly (never silent)', async () => {
    const sim = setup()
    await changeAddon(addonDeps(sim), live(sim), 'big_change', 'off')
    const { client } = flaky(sim, 99)
    const logs: string[] = []
    const failing = { save: async () => Promise.reject(new Error('db down')), open: async () => [], clear: async () => undefined, keep: async () => undefined }
    const r = await changePlanStep(
      { stripe: client, priceIdFor: async (id: PlanStepId) => SIM_PRICE_ID.step(id), now: sim.now, log: (m) => logs.push(m), sleep: async () => undefined, onRemovalOwed: (o) => recordRemovalOwed({ store: failing, alert: async () => undefined, log: (m) => logs.push(m) }, o) },
      live(sim),
      'fast_lane'
    )
    expect(r).toMatchObject({ ok: true, kind: 'upgraded', addonRemovalKept: false, removalOwed: false })
    expect(logs.some((m) => m.includes('FLAG NOT SAVED for sub_1'))).toBe(true)
  })
})

/** Vera L-4 (QA de173c8): the guards that survived her mutants (A, F, I). */
describe('L-4: once-only refund, no flag clear on a failed refund, stable owed-remove key', () => {
  async function owedRenewal() {
    const sim = setup()
    await changeAddon(addonDeps(sim), live(sim), 'big_change', 'off')
    const { store, rows } = memRemovalOwedStore()
    await store.save({ subscriptionId: 'sub_1', customerId: 'cus_1', userId: USER, addons: ['big_change'], effectiveAt: new Date(END * 1000).toISOString() })
    await sim.client().subscriptionSchedules.release(sim.sub('sub_1').schedule!) // what the failed upgrade left
    sim.advance(21 * 86_400)
    const [renewal] = renewals(sim)
    expect(renewal.total).toBe(6575) // two 575 notes would fit under the total: the sim's cap cannot hide a double refund
    return { sim, store, rows, renewal }
  }
  /** The same Stripe, but credit notes go out without our idempotency key: a redelivery more than 24 h later. */
  const keyExpired = (sim: StripeSim, opts: { dropMarker?: boolean } = {}) => {
    const c = sim.client()
    return {
      ...c,
      creditNotes: { ...c.creditNotes, create: (p: Parameters<typeof c.creditNotes.create>[0]) => c.creditNotes.create(p) },
      invoices: {
        ...c.invoices,
        retrieve: async (id: string) => {
          const inv = await c.invoices.retrieve(id)
          if (!opts.dropMarker) return inv
          const metadata = { ...inv.metadata }
          delete metadata[ADDON_REFUNDED_META]
          return { ...inv, metadata }
        },
      },
    } as unknown as Stripe
  }

  it('A: the refund guard holds on its own, with no Stripe idempotency key (a redelivery after 24 h): one credit note', async () => {
    const { sim, renewal } = await owedRenewal()
    const stripe = keyExpired(sim)
    const logs: string[] = []
    for (let i = 0; i < 3; i++) expect(await refundAddonCharge(stripe, renewal.id, renewal.amount_paid, 575, (m) => logs.push(m), 'turned_off')).toMatchObject({ ok: true })
    expect(sim.creditNotes).toEqual([expect.objectContaining({ invoice: renewal.id, amount: 575 })])
    expect(logs.filter((m) => m.includes('already refunded'))).toHaveLength(2)
  })

  it('A: the marker is lost but the credit note is on the invoice: still no second refund (and the mark is written back)', async () => {
    const { sim, renewal } = await owedRenewal()
    expect(await refundAddonCharge(keyExpired(sim), renewal.id, renewal.amount_paid, 575, () => {}, 'turned_off')).toMatchObject({ ok: true })
    expect(await refundAddonCharge(keyExpired(sim, { dropMarker: true }), renewal.id, renewal.amount_paid, 575, () => {}, 'turned_off')).toMatchObject({ ok: true })
    expect(sim.creditNotes).toHaveLength(1)
  })

  it('A: the heal redelivered after 24 h (flag re-opened, no key): already_refunded, one credit note', async () => {
    const { sim, store, renewal } = await owedRenewal()
    expect(await healOwedRemovals({ stripe: keyExpired(sim), store, log: () => {} }, renewal)).toMatchObject({ outcome: 'refunded' })
    const again = memRemovalOwedStore()
    await again.store.save({ subscriptionId: 'sub_1', customerId: 'cus_1', userId: USER, addons: ['big_change'], effectiveAt: new Date(END * 1000).toISOString() })
    expect(await healOwedRemovals({ stripe: keyExpired(sim), store: again.store, log: () => {} }, renewal)).toMatchObject({ outcome: 'already_refunded' })
    expect(sim.creditNotes).toHaveLength(1)
  })

  it('F: the refund fails inside the heal: retry, the flag stays open; the redelivery refunds once and clears it', async () => {
    const { sim, store, rows, renewal } = await owedRenewal()
    const c = sim.client()
    const broken = { ...c, creditNotes: { ...c.creditNotes, create: () => Promise.reject(Object.assign(new Error('stripe 500 (simulated)'), { type: 'StripeAPIError', statusCode: 500 })) } } as unknown as Stripe
    expect(await healOwedRemovals({ stripe: broken, store, log: () => {} }, renewal)).toMatchObject({ outcome: 'retry', reason: 'refund_failed' })
    expect(rows[0].clearedHow).toBeNull()
    expect(sim.creditNotes).toHaveLength(0)
    expect(addonsOn(sim)).toEqual(['small_edit']) // Big change is already gone; only the money is still owed
    expect(await healOwedRemovals({ stripe: c as unknown as Stripe, store, log: () => {} }, renewal)).toMatchObject({ outcome: 'refunded', cardCents: 575 })
    expect(sim.creditNotes).toHaveLength(1)
    expect(rows[0]).toMatchObject({ clearedHow: 'refunded', clearedInvoiceId: renewal.id })
  })

  it('I: the owed removal uses the stable key owed-remove:{sub}:{invoice}, the same on a redelivery', async () => {
    const { sim, store, rows, renewal } = await owedRenewal()
    const c = sim.client()
    const keys: (string | undefined)[] = []
    let failFirst = true
    const client = {
      ...c,
      subscriptions: {
        ...c.subscriptions,
        update: (id: string, p: Parameters<typeof c.subscriptions.update>[1], o?: { idempotencyKey?: string }) => {
          keys.push(o?.idempotencyKey)
          if (failFirst) {
            failFirst = false
            return Promise.reject(Object.assign(new Error('stripe 500 (simulated)'), { type: 'StripeAPIError', statusCode: 500 }))
          }
          return c.subscriptions.update(id, p, o)
        },
      },
    } as unknown as Stripe
    expect(await healOwedRemovals({ stripe: client, store, log: () => {} }, renewal)).toMatchObject({ outcome: 'retry' })
    expect(rows[0].clearedHow).toBeNull()
    expect(await healOwedRemovals({ stripe: client, store, log: () => {} }, renewal)).toMatchObject({ outcome: 'refunded' })
    expect(keys).toEqual([`owed-remove:sub_1:${renewal.id}`, `owed-remove:sub_1:${renewal.id}`])
    expect(addonsOn(sim)).toEqual(['small_edit'])
    expect(sim.creditNotes).toHaveLength(1)
  })
})
