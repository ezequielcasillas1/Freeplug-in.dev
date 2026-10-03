// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server actions hit directly (not through the UI): plan switching refuses sellable=false steps on
 * the server, never writes entitlements, syncs a never-synced profile BEFORE moving, and the
 * in-app cancel clears a pending downgrade first.
 */
const calls: string[] = []
let snapshotRow: Record<string, unknown> | null = null
let liveSubs: unknown[] = []
const syncMock = vi.fn(async () => (calls.push('webhook-sync(pre-move)'), { outcome: 'synced', stepId: 'starter' }))

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: (cols: string) => ({
        eq: () => ({
          single: async () => ({ data: { stripe_customer_id: 'cus_1' }, error: null }),
          maybeSingle: async () => ({ data: cols.includes('plan_step') ? snapshotRow : null, error: null }),
        }),
      }),
      update: () => {
        calls.push('profiles.update(customer client)')
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({}) }) }))
vi.mock('@/lib/plans/plan-step-sync', () => ({
  syncPlanStepForCustomer: (...a: unknown[]) => syncMock(...(a as [])),
  supabasePlanStepStore: () => ({}),
}))
vi.mock('@/lib/stripe/prices', () => ({ getStepPriceId: async (id: string) => `price_${id}` }))
vi.mock('@/lib/stripe/active-subscription', async (orig) => ({
  ...(await orig<typeof import('@/lib/stripe/active-subscription')>()),
  listLiveSubscriptions: async () => liveSubs,
}))
const PERIOD_END = 1_793_726_938
const portalSessions: Record<string, unknown>[] = []
let subscriptionsListFails = false
vi.mock('@/lib/stripe/config', () => ({ appBaseUrl: () => 'https://app.test' }))
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    billingPortal: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          calls.push('stripe.billingPortal.sessions.create')
          portalSessions.push(params)
          return { url: 'https://billing.stripe.test/session/x' }
        },
      },
    },
    subscriptions: {
      list: async () => {
        calls.push('stripe.subscriptions.list')
        if (subscriptionsListFails) throw new Error('stripe down')
        return { data: liveSubs }
      },
      update: async (id: string, params: Record<string, unknown>) => {
        calls.push(params.cancel_at_period_end ? 'stripe.subscriptions.update(cancel)' : 'stripe.subscriptions.update(items)')
        return { id, pending_update: null, latest_invoice: { id: 'in_1', status: 'paid' } }
      },
    },
    invoices: { voidInvoice: async () => (calls.push('stripe.invoices.void'), {}) },
    prices: { retrieve: async (id: string) => ({ id, lookup_key: null }) },
    subscriptionSchedules: {
      retrieve: async () => (
        calls.push('stripe.schedules.retrieve'),
        {
          id: 'sub_sched_1',
          status: 'active',
          current_phase: { start_date: 1, end_date: PERIOD_END },
          phases: [
            { start_date: 1, end_date: PERIOD_END, items: [{ price: 'price_growth', quantity: 1 }], metadata: {} },
            { start_date: PERIOD_END, end_date: PERIOD_END + 1, items: [{ price: 'price_fast_lane', quantity: 1 }], metadata: { plan_step: 'fast_lane' } },
          ],
        }
      ),
      create: async () => (calls.push('stripe.schedules.create'), { id: 'sub_sched_new', current_phase: { start_date: 1, end_date: PERIOD_END }, phases: [{ start_date: 1, end_date: PERIOD_END, items: [{ price: 'price_x', quantity: 1 }] }] }),
      update: async () => (calls.push('stripe.schedules.update'), {}),
      release: async () => (calls.push('stripe.schedules.release'), {}),
    },
  }),
}))

import { cancelHostingAtPeriodEnd, changeHostingPlan, openBillingPortal, updatePaymentMethod } from './billing-actions'
import { PLAN_STEPS } from '@/lib/plans/ladder'
import { STEP_NOT_SELLABLE_MESSAGE } from '@/lib/plans/ladder-copy'

const ladderSub = (id: string, over: Record<string, unknown> = {}) => {
  const s = PLAN_STEPS.find((p) => p.id === id)!
  return {
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    schedule: null,
    latest_invoice: 'in_0',
    items: { data: [{ id: 'si_1', quantity: 1, price: { id: `price_${id}`, lookup_key: s.lookupKey, unit_amount: s.monthlyCents, recurring: { interval: 'month' } } }] },
    ...over,
  }
}
const SYNCED = { plan_step: 'starter', plan_legacy: false, plan_legacy_addon: null, plan_monthly_cents: 3500, plan_step_synced_at: '2026-10-03T16:00:00Z' }

describe('changeHostingPlan (server action)', () => {
  beforeEach(() => {
    calls.length = 0
    syncMock.mockClear()
    snapshotRow = SYNCED
    liveSubs = [ladderSub('starter')]
  })

  it.each(PLAN_STEPS.filter((s) => !s.sellable).map((s) => [s.id, s.name] as const))(
    'refuses switching to %s (sellable=false) on the server; no Stripe write',
    async (id, name) => {
      expect(await changeHostingPlan(id)).toEqual({ ok: false, message: STEP_NOT_SELLABLE_MESSAGE(name) })
      expect(calls.filter((c) => c.startsWith('stripe.'))).toEqual([])
    }
  )

  it('an upgrade calls Stripe only; it never writes plan_step or perks (the webhook does)', async () => {
    const r = await changeHostingPlan('fast_lane')
    expect(r.ok).toBe(true)
    expect(calls).toEqual(['stripe.subscriptions.update(items)'])
    expect(syncMock).not.toHaveBeenCalled()
  })

  it('a never-synced profile is synced from Stripe BEFORE the move (so the move itself is webhook-driven)', async () => {
    snapshotRow = { ...SYNCED, plan_step_synced_at: null }
    await changeHostingPlan('priority')
    expect(calls).toEqual(['webhook-sync(pre-move)', 'stripe.subscriptions.update(items)'])
  })

  it('a customer already on a non-sellable step keeps it ("keep" releases a pending downgrade)', async () => {
    liveSubs = [ladderSub('growth', { schedule: 'sub_sched_1' })]
    expect(await changeHostingPlan('growth')).toMatchObject({ ok: true })
    expect(calls).toEqual(['stripe.schedules.release'])
  })

  it('upgrading while a downgrade is pending releases the schedule first', async () => {
    liveSubs = [ladderSub('priority', { schedule: 'sub_sched_1' })]
    expect(await changeHostingPlan('fast_lane')).toMatchObject({ ok: true })
    expect(calls).toEqual(['stripe.schedules.retrieve', 'stripe.schedules.release', 'stripe.subscriptions.update(items)'])
  })

  it('a plan set to end is refused (cancel then downgrade)', async () => {
    liveSubs = [ladderSub('fast_lane', { cancel_at_period_end: true })]
    expect(await changeHostingPlan('priority')).toMatchObject({ ok: false })
    expect(calls.filter((c) => c.startsWith('stripe.'))).toEqual([])
  })
})

describe('cancelHostingAtPeriodEnd (server action, cancel page with a pending downgrade)', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('downgrade then cancel: releases the schedule, then sets cancel_at_period_end', async () => {
    liveSubs = [ladderSub('growth', { schedule: 'sub_sched_1' })]
    await expect(cancelHostingAtPeriodEnd()).rejects.toMatchObject({ url: '/dashboard/cancel?canceled=1' })
    expect(calls).toEqual(['stripe.schedules.retrieve', 'stripe.schedules.release', 'stripe.subscriptions.update(cancel)'])
  })

  it('no live plan: nothing written, error flag', async () => {
    liveSubs = []
    await expect(cancelHostingAtPeriodEnd()).rejects.toMatchObject({ url: '/dashboard/cancel?cancel_error=1' })
    expect(calls).toEqual([])
  })
})

describe('Manage billing while a plan switch is planned (Aria, Oct 3 12:56)', () => {
  beforeEach(() => {
    calls.length = 0
    portalSessions.length = 0
    subscriptionsListFails = false
  })

  it('no schedule: Manage billing opens the Billing Portal as before', async () => {
    liveSubs = [ladderSub('fast_lane')]
    await expect(openBillingPortal()).rejects.toMatchObject({ url: 'https://billing.stripe.test/session/x' })
    expect(calls).toEqual(['stripe.subscriptions.list', 'stripe.billingPortal.sessions.create'])
    expect(portalSessions[0]).toMatchObject({ customer: 'cus_1', return_url: 'https://app.test/dashboard' })
    expect(portalSessions[0]).not.toHaveProperty('flow_data')
  })

  it('with a schedule: Manage billing goes to the Plans page notice; no portal session at all', async () => {
    liveSubs = [ladderSub('fast_lane', { schedule: 'sub_sched_1' })]
    await expect(openBillingPortal()).rejects.toMatchObject({ url: '/dashboard/plans?billing=pending' })
    expect(calls).toEqual(['stripe.subscriptions.list'])
  })

  it('an ended subscription with a leftover schedule does not count', async () => {
    liveSubs = [ladderSub('fast_lane', { status: 'canceled', schedule: 'sub_sched_old' })]
    await expect(openBillingPortal()).rejects.toMatchObject({ url: 'https://billing.stripe.test/session/x' })
  })

  it('if Stripe cannot say whether a schedule exists, the portal is not opened', async () => {
    subscriptionsListFails = true
    await expect(openBillingPortal()).rejects.toMatchObject({ url: '/dashboard/plans?billing=unavailable' })
    expect(calls).not.toContain('stripe.billingPortal.sessions.create')
  })

  it.each([
    ['without a schedule', null],
    ['with a schedule', 'sub_sched_1'],
  ])('Update card %s: a portal session limited to the payment_method_update flow, back to Plans', async (_label, schedule) => {
    liveSubs = [ladderSub('fast_lane', { schedule })]
    await expect(updatePaymentMethod()).rejects.toMatchObject({ url: 'https://billing.stripe.test/session/x' })
    expect(calls).toEqual(['stripe.billingPortal.sessions.create'])
    expect(portalSessions[0]).toEqual({
      customer: 'cus_1',
      return_url: 'https://app.test/dashboard/plans?card=updated',
      flow_data: {
        type: 'payment_method_update',
        after_completion: { type: 'redirect', redirect: { return_url: 'https://app.test/dashboard/plans?card=updated' } },
      },
    })
  })
})
