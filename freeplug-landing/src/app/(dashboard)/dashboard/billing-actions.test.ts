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
// Change-plan lock (migration 20261003210000): an in-memory stand-in for plan_change_lock_claim /
// _release with the same semantics (one atomic check-and-set per call, 60 s expiry, release only by
// the same claim). Kept out of `calls`, which records Stripe traffic.
const locks = new Map<string, { claimId: string; expiresAt: number }>()
const lockEvents: string[] = []
let lockRpcFails = false
let claimSeq = 0
const lockRpc = async (fn: string, args: Record<string, unknown>) => {
  if (lockRpcFails) return { data: null, error: { message: 'function public.plan_change_lock_claim does not exist', code: 'PGRST202' } }
  const user = String(args.p_user_id)
  if (fn === 'plan_change_lock_claim') {
    const held = locks.get(user)
    if (held && held.expiresAt > Date.now()) return (lockEvents.push('claim:held'), { data: null, error: null })
    const claimId = `00000000-0000-4000-8000-${String(++claimSeq).padStart(12, '0')}`
    locks.set(user, { claimId, expiresAt: Date.now() + Number(args.p_ttl_seconds) * 1000 })
    lockEvents.push(`claim:ok:${args.p_ttl_seconds}`)
    return { data: claimId, error: null }
  }
  if (fn === 'plan_change_lock_release') {
    const held = locks.get(user)
    const mine = held?.claimId === args.p_claim_id
    if (mine) locks.delete(user)
    lockEvents.push(mine ? 'release:ok' : 'release:not-mine')
    return { data: mine, error: null }
  }
  return { data: null, error: { message: `unknown rpc ${fn}` } }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({}), rpc: lockRpc }) }))
vi.mock('@/lib/plans/plan-step-sync', () => ({
  syncPlanStepForCustomer: (...a: unknown[]) => syncMock(...(a as [])),
  supabasePlanStepStore: () => ({}),
}))
vi.mock('@/lib/stripe/prices', () => ({ getStepPriceId: async (id: string) => `price_${id}` }))
const listedCustomers: string[] = []
let liveListFails = false
vi.mock('@/lib/stripe/active-subscription', async (orig) => ({
  ...(await orig<typeof import('@/lib/stripe/active-subscription')>()),
  listLiveSubscriptions: async (customerId: string) => {
    listedCustomers.push(customerId)
    if (liveListFails) throw new Error('stripe down')
    return liveSubs
  },
}))
let rateAllowed = true
const rateKeys: string[] = []
vi.mock('@/lib/rate-limit', () => ({
  PLAN_PREVIEW_LIMIT: { bucket: 'plan_preview_user', limit: 20, windowSeconds: 600 },
  rateCheck: async (_rule: unknown, key: string) => (rateKeys.push(key), rateAllowed),
}))
let previewFails = false
let updateKeyInUse = false
let updateDelayMs = 0
let updateFails: Error | null = null
const updateParams: Record<string, unknown>[] = []
const previewParams: Record<string, unknown>[] = []
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
        updateParams.push(params)
        calls.push(
          params.cancel_at_period_end ? 'stripe.subscriptions.update(cancel)' : params.cancel_at_period_end === false ? 'stripe.subscriptions.update(resume)' : 'stripe.subscriptions.update(items)'
        )
        if (updateDelayMs) await new Promise((r) => setTimeout(r, updateDelayMs))
        if (updateFails) throw updateFails
        if (updateKeyInUse) throw Object.assign(new Error('another in-progress request'), { type: 'StripeIdempotencyError', code: 'idempotency_key_in_use' })
        return { id, pending_update: null, latest_invoice: { id: 'in_1', status: 'paid' } }
      },
    },
    invoices: {
      voidInvoice: async () => (calls.push('stripe.invoices.void'), {}),
      createPreview: async (params: Record<string, unknown>) => {
        calls.push('stripe.invoices.createPreview')
        previewParams.push(params)
        if (previewFails) throw new Error('stripe down')
        return { amount_due: 1953, currency: 'usd' }
      },
    },
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

import { cancelHostingAtPeriodEnd, changeHostingPlan, changeTipAction, openBillingPortal, previewPlanChange, previewTipChangeAction, resumePlan, updatePaymentMethod } from './billing-actions'
import { PLAN_STEPS } from '@/lib/plans/ladder'
import { CHANGE_PLAN_ENDING, RESUME_FAILED_MESSAGE, STEP_NOT_SELLABLE_MESSAGE, TIP_CHANGE_ENDING, TIP_IN_PROGRESS, UPGRADE_IN_PROGRESS, UPGRADE_PREVIEW_EXPIRED } from '@/lib/plans/ladder-copy'

const ladderSub = (id: string, over: Record<string, unknown> = {}) => {
  const s = PLAN_STEPS.find((p) => p.id === id)!
  return {
    id: 'sub_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    schedule: null,
    latest_invoice: 'in_0',
    items: { data: [{ id: 'si_1', quantity: 1, current_period_end: PERIOD_END, price: { id: `price_${id}`, lookup_key: s.lookupKey, unit_amount: s.monthlyCents, recurring: { interval: 'month' } } }] },
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
    expect(calls).toEqual(['stripe.schedules.retrieve', 'stripe.schedules.release'])
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

describe('cancelHostingAtPeriodEnd (the only cancel, under the change-plan lock; Aria 4:05 PM)', () => {
  beforeEach(() => {
    calls.length = 0
    lockEvents.length = 0
    locks.clear()
  })

  it('no pending change: the app cancels at period end itself (no portal), inside the lock', async () => {
    liveSubs = [ladderSub('starter')]
    await expect(cancelHostingAtPeriodEnd()).rejects.toMatchObject({ url: '/dashboard/cancel?canceled=1' })
    expect(calls).toEqual(['stripe.subscriptions.update(cancel)'])
    expect(calls).not.toContain('stripe.billingPortal.sessions.create')
    expect(lockEvents).toEqual(['claim:ok:60', 'release:ok'])
  })

  it('a held lock (a plan or tip change in flight): no Stripe call, error flag', async () => {
    liveSubs = [ladderSub('starter')]
    locks.set('u1', { claimId: 'other', expiresAt: Date.now() + 30_000 })
    await expect(cancelHostingAtPeriodEnd()).rejects.toMatchObject({ url: '/dashboard/cancel?cancel_error=1' })
    expect(calls).toEqual([])
    locks.clear()
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

describe('Manage billing: card-only portal (Aria 4:05 PM); Plans page while a switch is planned (12:56)', () => {
  const CARD_ONLY_SESSION = {
    customer: 'cus_1',
    return_url: 'https://app.test/dashboard/plans?card=updated',
    configuration: 'bpc_cardonly1',
    flow_data: {
      type: 'payment_method_update',
      after_completion: { type: 'redirect', redirect: { return_url: 'https://app.test/dashboard/plans?card=updated' } },
    },
  }
  beforeEach(() => {
    calls.length = 0
    portalSessions.length = 0
    subscriptionsListFails = false
    process.env.STRIPE_PORTAL_CONFIGURATION_ID = 'bpc_cardonly1'
  })

  it('no schedule: Manage billing opens a payment_method_update flow on the dedicated configuration, back to Plans', async () => {
    liveSubs = [ladderSub('fast_lane')]
    await expect(openBillingPortal()).rejects.toMatchObject({ url: 'https://billing.stripe.test/session/x' })
    expect(calls).toEqual(['stripe.subscriptions.list', 'stripe.billingPortal.sessions.create'])
    expect(portalSessions[0]).toEqual(CARD_ONLY_SESSION)
  })

  it('without STRIPE_PORTAL_CONFIGURATION_ID the portal is refused (no session, never the default configuration)', async () => {
    delete process.env.STRIPE_PORTAL_CONFIGURATION_ID
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    liveSubs = [ladderSub('fast_lane')]
    await expect(openBillingPortal()).rejects.toMatchObject({ url: '/dashboard/plans?billing=unavailable' })
    await expect(updatePaymentMethod()).rejects.toMatchObject({ url: '/dashboard/plans?billing=unavailable' })
    expect(calls).not.toContain('stripe.billingPortal.sessions.create')
    expect(err).toHaveBeenCalledWith('[billing] portal refused:', expect.stringContaining('STRIPE_PORTAL_CONFIGURATION_ID'))
    err.mockRestore()
  })

  it('with a schedule: Manage billing goes to the Plans page notice; no portal session at all', async () => {
    liveSubs = [ladderSub('fast_lane', { schedule: 'sub_sched_1' })]
    await expect(openBillingPortal()).rejects.toMatchObject({ url: '/dashboard/plans?billing=pending' })
    // pending = a schedule phase starts in the future (read, never released)
    expect(calls).toEqual(['stripe.subscriptions.list', 'stripe.schedules.retrieve'])
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
    expect(portalSessions[0]).toEqual(CARD_ONLY_SESSION)
  })
})

describe('Resume plan (Aria 4:05 PM): clears only cancel_at_period_end, under the lock; never the portal', () => {
  beforeEach(() => {
    calls.length = 0
    updateParams.length = 0
    lockEvents.length = 0
    locks.clear()
    updateFails = null
    process.env.STRIPE_PORTAL_CONFIGURATION_ID = 'bpc_cardonly1'
  })
  // Stripe's real shape after a cancel at period end: BOTH fields set (Vera 5b R1)
  const ending = () => ladderSub('starter', { cancel_at_period_end: true, cancel_at: PERIOD_END })

  it('success: one update with ONLY cancel_at_period_end:false, inside the lock, back to the dashboard', async () => {
    liveSubs = [ending()]
    await expect(resumePlan()).rejects.toMatchObject({ url: '/dashboard?hosting=resumed' })
    expect(calls).toEqual(['stripe.subscriptions.update(resume)'])
    expect(updateParams).toEqual([{ cancel_at_period_end: false }])
    expect(lockEvents).toEqual(['claim:ok:60', 'release:ok'])
  })

  it('plan set to end (Sable 4:32 PM): a tip preview/change gets TIP_CHANGE_ENDING, a plan switch gets CHANGE_PLAN_ENDING; nothing written', async () => {
    liveSubs = [ending()]
    expect(await previewTipChangeAction(3)).toEqual({ ok: false, message: TIP_CHANGE_ENDING })
    expect(await changeTipAction(3)).toEqual({ ok: false, message: TIP_CHANGE_ENDING })
    expect(await changeHostingPlan('fast_lane')).toMatchObject({ ok: false, message: CHANGE_PLAN_ENDING })
    expect(updateParams).toEqual([])
    expect(TIP_CHANGE_ENDING).not.toBe(CHANGE_PLAN_ENDING)
  })

  it('the error shown on /dashboard?hosting=resume_failed has the support contact', () => {
    expect(RESUME_FAILED_MESSAGE).toContain('support@freeplug-in.dev')
    expect(RESUME_FAILED_MESSAGE).toContain('737-392-5612')
  })

  it('a forced Stripe failure: the support error page, no portal session, lock released', async () => {
    liveSubs = [ending()]
    updateFails = new Error('Received both cancel_at_period_end and cancel_at parameters. Please pass in only one.')
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(resumePlan()).rejects.toMatchObject({ url: '/dashboard?hosting=resume_failed' })
    expect(calls).not.toContain('stripe.billingPortal.sessions.create')
    expect(lockEvents).toEqual(['claim:ok:60', 'release:ok'])
    err.mockRestore()
  })

  it('nothing to resume, or the lock held: the support error, no Stripe write, no portal', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    liveSubs = [ladderSub('starter')]
    await expect(resumePlan()).rejects.toMatchObject({ url: '/dashboard?hosting=resume_failed' })
    liveSubs = [ending()]
    locks.set('u1', { claimId: 'other', expiresAt: Date.now() + 30_000 })
    await expect(resumePlan()).rejects.toMatchObject({ url: '/dashboard?hosting=resume_failed' })
    expect(calls).toEqual([])
    locks.clear()
    err.mockRestore()
  })
})

describe('previewPlanChange + confirm (Aria, Oct 3 1:34 PM)', () => {
  beforeEach(() => {
    calls.length = 0
    updateParams.length = 0
    previewParams.length = 0
    listedCustomers.length = 0
    rateKeys.length = 0
    rateAllowed = true
    previewFails = false
    snapshotRow = SYNCED
    liveSubs = [ladderSub('starter')]
  })
  const nowS = () => Math.floor(Date.now() / 1000)

  it("previews the caller's own subscription only (read-only), with a fresh server proration_date", async () => {
    const before = nowS()
    const r = await previewPlanChange('fast_lane')
    expect(r).toMatchObject({ ok: true, amountDueCents: 1953, nextAmountCents: 6500, nextDate: 'November 3, 2026' })
    const pd = (r as { prorationDate: number }).prorationDate
    expect(pd).toBeGreaterThanOrEqual(before)
    expect(pd).toBeLessThanOrEqual(nowS())
    expect(listedCustomers).toEqual(['cus_1']) // from the signed-in user's profile, never from the browser
    expect(rateKeys).toEqual(['u1'])
    expect(calls).toEqual(['stripe.invoices.createPreview'])
    expect(previewParams[0]).toMatchObject({ subscription: 'sub_1', subscription_details: { proration_behavior: 'always_invoice', proration_date: pd } })
  })

  it('rate limited: no Stripe call; the fallback still gets a proration_date', async () => {
    rateAllowed = false
    const r = await previewPlanChange('fast_lane')
    expect(r).toMatchObject({ ok: false, reason: 'rate_limited' })
    expect(typeof (r as { prorationDate: number }).prorationDate).toBe('number')
    expect(calls).toEqual([])
  })

  it("Stripe preview failure: 'preview_failed' with the proration_date (\"We'll charge the difference today\")", async () => {
    previewFails = true
    const r = await previewPlanChange('priority')
    expect(r).toMatchObject({ ok: false, reason: 'preview_failed' })
    expect(typeof (r as { prorationDate: number }).prorationDate).toBe('number')
  })

  it('downgrades and unknown steps get no preview', async () => {
    liveSubs = [ladderSub('fast_lane')]
    expect(await previewPlanChange('starter')).toEqual({ ok: false, reason: 'not_upgrade', prorationDate: null })
    expect(await previewPlanChange('nope')).toEqual({ ok: false, reason: 'unavailable', prorationDate: null })
    expect(calls).toEqual([])
  })

  it('Confirm passes the previewed proration_date to the subscription update', async () => {
    const r = await previewPlanChange('fast_lane')
    const pd = (r as { prorationDate: number }).prorationDate
    expect(await changeHostingPlan('fast_lane', pd)).toMatchObject({ ok: true })
    expect(updateParams[0]).toMatchObject({ proration_date: pd, proration_behavior: 'always_invoice' })
  })

  it('a stale (over 10 minutes) or future proration_date is refused: no Stripe write, the "check again" line', async () => {
    for (const pd of [nowS() - 601, nowS() + 60]) {
      calls.length = 0
      expect(await changeHostingPlan('fast_lane', pd)).toEqual({ ok: false, message: UPGRADE_PREVIEW_EXPIRED, code: 'stale_preview' })
      expect(calls.filter((c) => c.startsWith('stripe.'))).toEqual([])
    }
  })

  it('a second Confirm while the first is still in flight (Stripe 409 on the same key) gets the "already going through" line', async () => {
    const r = await previewPlanChange('fast_lane')
    const pd = (r as { prorationDate: number }).prorationDate
    updateKeyInUse = true
    try {
      expect(await changeHostingPlan('fast_lane', pd)).toEqual({ ok: false, message: UPGRADE_IN_PROGRESS, code: 'in_progress' })
    } finally {
      updateKeyInUse = false
    }
  })

  it('a malformed proration_date from the browser is refused without touching Stripe', async () => {
    expect(await changeHostingPlan('fast_lane', '1790000000' as unknown as number)).toMatchObject({ ok: false })
    expect(await changeHostingPlan('fast_lane', 1.5)).toMatchObject({ ok: false })
    expect(calls.filter((c) => c.startsWith('stripe.'))).toEqual([])
  })
})

describe('change-plan lock (Aria, Oct 3: per-user claimed row, 60 s, claim before any Stripe call)', () => {
  beforeEach(() => {
    calls.length = 0
    updateParams.length = 0
    listedCustomers.length = 0
    lockEvents.length = 0
    locks.clear()
    lockRpcFails = false
    updateDelayMs = 0
    snapshotRow = SYNCED
  })

  it('two concurrent Confirms with a downgrade pending: exactly one upgrade, one charge, the downgrade released; the other gets UPGRADE_IN_PROGRESS and never calls Stripe', async () => {
    liveSubs = [ladderSub('priority', { schedule: 'sub_sched_1' })]
    updateDelayMs = 30 // the first upgrade is still running when the second Confirm arrives
    const pd = Math.floor(Date.now() / 1000)
    const [a, b] = await Promise.all([changeHostingPlan('fast_lane', pd), changeHostingPlan('fast_lane', pd)])
    const results = [a, b]
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, message: UPGRADE_IN_PROGRESS, code: 'in_progress' }])
    // One Stripe pass only: one subscription read, the schedule released once, one always_invoice update (one charge).
    expect(listedCustomers).toEqual(['cus_1'])
    expect(calls).toEqual(['stripe.schedules.retrieve', 'stripe.schedules.release', 'stripe.subscriptions.update(items)'])
    expect(updateParams).toHaveLength(1)
    expect(updateParams[0]).toMatchObject({ proration_behavior: 'always_invoice' })
    expect(lockEvents).toEqual(['claim:ok:60', 'claim:held', 'release:ok'])
    expect(locks.size).toBe(0)
  })

  it('the lock is released in finally, also when the change throws, so the next change can run', async () => {
    liveSubs = [ladderSub('starter')]
    liveListFails = true
    try {
      expect(await changeHostingPlan('fast_lane')).toMatchObject({ ok: false })
    } finally {
      liveListFails = false
    }
    expect(lockEvents).toEqual(['claim:ok:60', 'release:ok'])
    expect(await changeHostingPlan('fast_lane')).toMatchObject({ ok: true })
    expect(locks.size).toBe(0)
  })

  it('a held lock refuses without any Stripe call; an expired one is taken over', async () => {
    liveSubs = [ladderSub('starter')]
    locks.set('u1', { claimId: 'other', expiresAt: Date.now() + 30_000 })
    expect(await changeHostingPlan('fast_lane')).toEqual({ ok: false, message: UPGRADE_IN_PROGRESS, code: 'in_progress' })
    expect(calls).toEqual([])
    expect(listedCustomers).toEqual([])
    locks.set('u1', { claimId: 'other', expiresAt: Date.now() - 1 })
    expect(await changeHostingPlan('fast_lane')).toMatchObject({ ok: true })
  })

  it('a tip change while the lock is held gets TIP_IN_PROGRESS (Sable, round 5b), not the plan-change message, and never calls Stripe', async () => {
    liveSubs = [ladderSub('starter')]
    locks.set('u1', { claimId: 'other', expiresAt: Date.now() + 30_000 })
    const r = await changeTipAction(5)
    expect(r).toEqual({ ok: false, message: TIP_IN_PROGRESS })
    expect(r.message).toBe('Your tip change is already going through. Refresh in a moment to see it.')
    expect(r.message).not.toBe(UPGRADE_IN_PROGRESS)
    expect(calls).toEqual([])
    expect(listedCustomers).toEqual([])
    expect(lockEvents).toEqual(['claim:held'])
  })

  it('fails closed: if the lock cannot be claimed (DB down, migration missing) nothing reaches Stripe', async () => {
    liveSubs = [ladderSub('starter')]
    lockRpcFails = true
    expect(await changeHostingPlan('fast_lane')).toMatchObject({ ok: false })
    expect(calls).toEqual([])
    expect(listedCustomers).toEqual([])
  })
})
