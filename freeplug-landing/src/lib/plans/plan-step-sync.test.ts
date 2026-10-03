// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { PLAN_STEPS } from './ladder'
import { supabasePlanStepStore, syncPlanStepForCustomer, type PlanStepStore } from './plan-step-sync'
import { entitlementsForSubscription, getEntitlements } from '@/lib/stripe/active-subscription'

type Item = { price: Record<string, unknown>; quantity?: number }
function sub(items: Item[], over: Record<string, unknown> = {}) {
  return { id: 'sub_1', status: 'active', metadata: {}, items: { data: items }, ...over } as unknown as Stripe.Subscription
}
const ladderItem = (id: string): Item => {
  const s = PLAN_STEPS.find((p) => p.id === id)!
  return { price: { id: `price_${id}`, lookup_key: s.lookupKey, unit_amount: s.monthlyCents, recurring: { interval: 'month' }, product: 'freeplug_hosting_ladder', metadata: { plan_step: id } }, quantity: 1 }
}
const legacyHosting = (cents: number): Item => ({ price: { id: 'price_h', lookup_key: null, unit_amount: cents, recurring: { interval: 'month' }, product: 'prod_hosting_adhoc', metadata: {} }, quantity: 1 })
const legacyAddonAdhoc = (cents: number): Item => ({ price: { id: 'price_a', lookup_key: null, unit_amount: cents, recurring: { interval: 'month' }, product: 'prod_addon_adhoc', metadata: {} }, quantity: 1 })

/** A Stripe fake that records every WRITE so the tests can prove nothing is migrated. */
function fakeStripe(subs: Stripe.Subscription[]) {
  const writes = {
    subscriptionsUpdate: vi.fn(),
    subscriptionsCancel: vi.fn(),
    subscriptionItemsUpdate: vi.fn(),
    schedulesCreate: vi.fn(),
    customersUpdate: vi.fn(),
  }
  const stripe = {
    subscriptions: { list: vi.fn(async () => ({ data: subs })), update: writes.subscriptionsUpdate, cancel: writes.subscriptionsCancel },
    subscriptionItems: { update: writes.subscriptionItemsUpdate },
    subscriptionSchedules: { create: writes.schedulesCreate },
    customers: { update: writes.customersUpdate },
    products: {
      retrieve: vi.fn(async (id: string) =>
        id === 'prod_addon_adhoc' ? { id, name: 'Pro add-on (Google Business Profile)' } : { id, name: 'Website hosting' }
      ),
    },
  }
  return { stripe: stripe as unknown as Stripe, writes }
}
function memStore(): PlanStepStore & { calls: unknown[][] } {
  const calls: unknown[][] = []
  return { calls, async writePlanStep(...a) { calls.push(a); return 1 } }
}
const NOW = () => new Date('2026-10-03T17:00:00Z')

describe('entitlements from Stripe subscriptions', () => {
  it('a ladder subscription is read by lookup key', async () => {
    const e = await entitlementsForSubscription(sub([ladderItem('get_found')]), async (id) => ({ id, name: 'x' }))
    expect(e.step?.id).toBe('get_found')
    expect(e.legacy).toBe(false)
  })

  it('falls back to subscription metadata.plan_step', async () => {
    const e = await entitlementsForSubscription(
      sub([{ price: { id: 'p', lookup_key: null, unit_amount: 7500, recurring: { interval: 'month' }, product: 'freeplug_hosting_ladder', metadata: {} } }], {
        metadata: { plan_step: 'leads' },
      }),
      async (id) => ({ id, name: 'x' })
    )
    expect(e.step?.id).toBe('leads')
  })

  it('outreach legacy publish: fixed add-on product id + metadata.addon_tier', async () => {
    const e = await entitlementsForSubscription(
      sub([legacyHosting(4000), { price: { id: 'p2', lookup_key: null, unit_amount: 1500, recurring: { interval: 'month' }, product: 'freeplug_addon_pro_monthly', metadata: {} } }], {
        metadata: { addon_tier: 'pro' },
      }),
      async (id) => ({ id, name: 'Website hosting' })
    )
    expect(e).toMatchObject({ legacy: true, legacyAddon: 'pro', monthlyCents: 5500, priorityRank: 1, gbpManaged: true, includedEditsPerMonth: 1 })
  })
})

describe('grandfathered subscriber: read, never migrated', () => {
  it('ad-hoc $35 hosting + "Pro add-on" dashboard checkout keeps its perks and Stripe is never written to', async () => {
    const legacy = sub([legacyHosting(3500), legacyAddonAdhoc(1500)])
    const { stripe, writes } = fakeStripe([legacy])
    const before = JSON.stringify(legacy)

    const e = await getEntitlements('cus_legacy', stripe)
    expect(e).toMatchObject({ legacy: true, legacyAddon: 'pro', monthlyCents: 5000, gbpManaged: true, includedEditsPerMonth: 1, priorityRank: 0 })
    expect(e.step?.id).toBe('starter')

    const store = memStore()
    const r = await syncPlanStepForCustomer({ stripe, store, now: NOW }, 'cus_legacy')
    expect(r).toEqual({ outcome: 'synced', stepId: 'starter' })

    for (const w of Object.values(writes)) expect(w).not.toHaveBeenCalled()
    expect(JSON.stringify(legacy)).toBe(before)
  })

  it('a legacy Basic subscriber never gets backups/alerts or an included edit, and is not moved to a step price', async () => {
    const legacy = sub([legacyHosting(3500), { price: { id: 'pb', lookup_key: null, unit_amount: 500, recurring: { interval: 'month' }, product: 'freeplug_addon_basic_monthly', metadata: {} } }])
    const { stripe, writes } = fakeStripe([legacy])
    const e = await getEntitlements('cus_b', stripe)
    expect(e).toMatchObject({ legacy: true, legacyAddon: 'basic', includedEditsPerMonth: 0, gbpManaged: false })
    expect(JSON.stringify(e)).not.toMatch(/backup|downtime/i)
    expect(e.quoteAlerts).toBe(false)
    for (const w of Object.values(writes)) expect(w).not.toHaveBeenCalled()
  })
})

describe('syncPlanStepForCustomer (webhook)', () => {
  it('writes the current step, and the same value again on a replay (idempotent)', async () => {
    const { stripe } = fakeStripe([sub([ladderItem('fast_lane')])])
    const store = memStore()
    await syncPlanStepForCustomer({ stripe, store, now: NOW }, 'cus_1')
    await syncPlanStepForCustomer({ stripe, store, now: NOW }, 'cus_1')
    const snap = { stepId: 'fast_lane', legacy: false, legacyAddon: null, monthlyCents: 6500, tipCents: 0 }
    expect(store.calls).toEqual([
      ['cus_1', snap, '2026-10-03T17:00:00.000Z'],
      ['cus_1', snap, '2026-10-03T17:00:00.000Z'],
    ])
  })

  it('ignores ended and incomplete subscriptions; no live plan writes null', async () => {
    const { stripe } = fakeStripe([sub([ladderItem('growth')], { status: 'canceled' }), sub([ladderItem('leads')], { status: 'incomplete' })])
    const store = memStore()
    expect(await syncPlanStepForCustomer({ stripe, store, now: NOW }, 'cus_1')).toEqual({ outcome: 'synced', stepId: null })
    expect(store.calls[0][1]).toEqual({ stepId: null, legacy: false, legacyAddon: null, monthlyCents: null, tipCents: 0 })
  })

  it('reports no_profile when no profile has the customer id', async () => {
    const { stripe } = fakeStripe([sub([ladderItem('starter')])])
    const r = await syncPlanStepForCustomer({ stripe, store: { writePlanStep: async () => 0 }, now: NOW }, 'cus_x')
    expect(r.outcome).toBe('no_profile')
  })

  it('a Stripe or database failure throws (the webhook answers 500 and Stripe retries)', async () => {
    const bad = { subscriptions: { list: vi.fn(async () => { throw new Error('network') }) } } as unknown as Stripe
    await expect(syncPlanStepForCustomer({ stripe: bad, store: memStore() }, 'c')).rejects.toThrow('network')
    const { stripe } = fakeStripe([sub([ladderItem('starter')])])
    const admin = {
      from: () => ({ update: () => ({ eq: () => ({ select: async () => ({ data: null, error: { message: 'permission denied' } }) }) }) }),
    }
    await expect(
      syncPlanStepForCustomer({ stripe, store: supabasePlanStepStore(admin as unknown as Parameters<typeof supabasePlanStepStore>[0]) }, 'c')
    ).rejects.toThrow(/permission denied/)
  })

  it('the Supabase store updates profiles by stripe_customer_id', async () => {
    const seen: unknown[] = []
    const admin = {
      from: (t: string) => ({
        update: (v: unknown) => ({
          eq: (c: string, val: string) => ({
            select: async () => {
              seen.push(t, v, c, val)
              return { data: [{ id: 'u1' }], error: null }
            },
          }),
        }),
      }),
    }
    const store = supabasePlanStepStore(admin as unknown as Parameters<typeof supabasePlanStepStore>[0])
    expect(await store.writePlanStep('cus_1', { stepId: 'priority', legacy: true, legacyAddon: 'pro', monthlyCents: 5500, tipCents: 0 }, 't')).toBe(1)
    expect(seen).toEqual([
      'profiles',
      { plan_step: 'priority', plan_legacy: true, plan_legacy_addon: 'pro', plan_monthly_cents: 5500, plan_step_synced_at: 't', plan_tip_cents: 0 },
      'stripe_customer_id',
      'cus_1',
    ])
  })

  it('a grandfathered plan is written as legacy with its add-on and total', async () => {
    const { stripe } = fakeStripe([sub([legacyHosting(4000), legacyAddonAdhoc(1500)])])
    const store = memStore()
    await syncPlanStepForCustomer({ stripe, store, now: NOW }, 'cus_1')
    expect(store.calls[0][1]).toEqual({ stepId: 'priority', legacy: true, legacyAddon: 'pro', monthlyCents: 5500, tipCents: 0 })
  })

  it('creating a downgrade schedule fires customer.subscription.updated with only `schedule` changed: the re-sync writes the SAME step', async () => {
    // Test mode, Oct 3: subscription_schedule.created, then customer.subscription.updated with
    // previous_attributes = { schedule }. Items stay on the current price until the phase starts.
    const before = sub([ladderItem('leads')])
    const afterSchedule = sub([ladderItem('leads')], { schedule: 'sub_sched_1' })
    const a = memStore()
    const b = memStore()
    await syncPlanStepForCustomer({ stripe: fakeStripe([before]).stripe, store: a, now: NOW }, 'cus_1')
    await syncPlanStepForCustomer({ stripe: fakeStripe([afterSchedule]).stripe, store: b, now: NOW }, 'cus_1')
    expect(b.calls[0][1]).toEqual(a.calls[0][1])
    expect((b.calls[0][1] as { stepId: string }).stepId).toBe('leads')
  })

  it('the step changes only when Stripe says the subscription itself changed (phase start or upgrade applied)', async () => {
    const store = memStore()
    await syncPlanStepForCustomer({ stripe: fakeStripe([sub([ladderItem('priority')])]).stripe, store, now: NOW }, 'cus_1')
    expect((store.calls[0][1] as { stepId: string }).stepId).toBe('priority')
  })
})

describe('the tipping system: entitlements come from the step price only', () => {
  const tipItem = (dollars: number): Item => ({ price: { id: 'price_tip', lookup_key: 'freeplug_tip_monthly', unit_amount: 100, recurring: { interval: 'month' }, product: 'freeplug_tip', metadata: {} }, quantity: dollars })
  const noProduct = async (id: string) => ({ id, name: 'x' })

  it('Starter + a $20 tip is NOT Priority (rank 0, no priority queue), and the tip is carried separately', async () => {
    const e = await entitlementsForSubscription(sub([ladderItem('starter'), tipItem(20)]), noProduct)
    expect(e.step?.id).toBe('starter')
    expect(e.priorityRank).toBe(0)
    expect(e.monthlyCents).toBe(3500)
    expect(e.tipCents).toBe(2000)
  })

  it('the tier is found whatever the item order (tip item first)', async () => {
    const e = await entitlementsForSubscription(sub([tipItem(5), ladderItem('fast_lane')]), noProduct)
    expect(e.step?.id).toBe('fast_lane')
    expect(e.includedEditsPerMonth).toBe(1)
    expect(e.tipCents).toBe(500)
  })

  it('a legacy plan never counts a tip item into its hosting amount (no Priority bought by a tip)', async () => {
    const e = await entitlementsForSubscription(sub([legacyHosting(4000), tipItem(19)]), noProduct)
    expect(e.legacy).toBe(true)
    expect(e.monthlyCents).toBe(4000)
    expect(e.priorityRank).toBe(0)
  })

  it('the webhook snapshot writes plan_tip_cents next to the step', async () => {
    const { stripe } = fakeStripe([sub([ladderItem('priority'), tipItem(7)])])
    const store = memStore()
    await syncPlanStepForCustomer({ stripe, store, now: NOW }, 'cus_1')
    expect(store.calls[0][1]).toEqual({ stepId: 'priority', legacy: false, legacyAddon: null, monthlyCents: 5500, tipCents: 700 })
  })

  it('before the tipping migration: the snapshot is still written without plan_tip_cents (no webhook 500)', async () => {
    const seen: Record<string, unknown>[] = []
    const admin = {
      from: () => ({
        update: (v: Record<string, unknown>) => ({
          eq: () => ({
            select: async () => {
              seen.push(v)
              return 'plan_tip_cents' in v
                ? { data: null, error: { message: "Could not find the 'plan_tip_cents' column of 'profiles' in the schema cache", code: 'PGRST204' } }
                : { data: [{ id: 'u1' }], error: null }
            },
          }),
        }),
      }),
    }
    const store = supabasePlanStepStore(admin as unknown as Parameters<typeof supabasePlanStepStore>[0])
    expect(await store.writePlanStep('cus_1', { stepId: 'starter', legacy: false, legacyAddon: null, monthlyCents: 3500, tipCents: 500 }, 't')).toBe(1)
    expect(seen.map((v) => 'plan_tip_cents' in v)).toEqual([true, false])
  })
})
