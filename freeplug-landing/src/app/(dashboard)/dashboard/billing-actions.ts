'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { appBaseUrl } from '@/lib/stripe/config'
import { getStripe } from '@/lib/stripe/server'
import { resumeEndingSubscriptions } from '@/lib/stripe/resume-hosting'
import { billingPortalSessionParams } from '@/lib/stripe/portal'
import { findScheduledSubscription, paymentMethodUpdateSessionParams, PLANS_CARD_RETURN_PATH, PLANS_PENDING_BILLING_PATH } from '@/lib/stripe/billing-routing'
import { revalidatePath } from 'next/cache'
import { resolvePlanStep } from '@/lib/plans/ladder'
import { cancelPlanAtPeriodEnd, changePlanStep, previewPlanStepChange } from '@/lib/stripe/change-plan'
import { PLAN_PREVIEW_LIMIT, rateCheck } from '@/lib/rate-limit'
import { getStepPriceId } from '@/lib/stripe/prices'
import { formatPlanEndDate, listLiveSubscriptions } from '@/lib/stripe/active-subscription'
import { loadPlanSnapshotRow } from '@/lib/plans/plan-snapshot'
import { syncPlanSnapshotForCustomer } from '@/lib/stripe/sync-checkout-customer'
import {
  CHANGE_PLAN_ENDING,
  CHANGE_PLAN_PAYMENT_FAILED,
  CHANGE_PLAN_PAYMENT_FAILED_PENDING_LOST,
  CHANGE_PLAN_SCHEDULED,
  CHANGE_PLAN_UNAVAILABLE,
  CHANGE_PLAN_UNCHANGED,
  CHANGE_PLAN_UPGRADED,
  STEP_NOT_SELLABLE_MESSAGE,
  UPGRADE_IN_PROGRESS,
  UPGRADE_PREVIEW_EXPIRED,
} from '@/lib/plans/ladder-copy'

export async function openBillingPortal() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = prof?.stripe_customer_id
  if (!customerId) {
    return
  }

  const stripe = getStripe()
  // A planned switch (subscription schedule): billing is handled on the Plans page, never the portal
  // (Aria, Oct 3 12:56). If Stripe can't tell us, don't open the portal either.
  let scheduled: Awaited<ReturnType<typeof findScheduledSubscription>> = null
  try {
    scheduled = await findScheduledSubscription(stripe, customerId)
  } catch (e) {
    console.error('[billing] schedule check failed', e instanceof Error ? e.message : e)
    redirect('/dashboard/plans?billing=unavailable')
  }
  if (scheduled) redirect(PLANS_PENDING_BILLING_PATH)

  const session = await stripe.billingPortal.sessions.create(
    billingPortalSessionParams(customerId, `${appBaseUrl()}/dashboard`)
  )

  if (session.url) {
    redirect(session.url)
  }
}

/**
 * Plans page "Update card": a Billing Portal session limited to the payment_method_update flow
 * (no portal navigation; returns to the Plans page when done). Same with or without a planned switch.
 */
export async function updatePaymentMethod() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/plans')

  const { data: prof } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  const customerId = prof?.stripe_customer_id
  if (!customerId) redirect('/dashboard/plans?billing=unavailable')

  let url: string | null = null
  try {
    const session = await getStripe().billingPortal.sessions.create(
      paymentMethodUpdateSessionParams(customerId, `${appBaseUrl()}${PLANS_CARD_RETURN_PATH}`)
    )
    url = session.url ?? null
  } catch (e) {
    console.error('[billing] card update session failed', e instanceof Error ? e.message : e)
  }
  redirect(url ?? '/dashboard/plans?billing=unavailable')
}

/**
 * Dashboard "Resume plan" (shown while hosting is canceled but the paid period is still running):
 * undo the scheduled cancellation on the existing subscription, so there is no second plan and no
 * new charge. If nothing could be resumed here, fall back to the Stripe billing portal.
 * (When hosting has already ended, the dashboard shows "Restart hosting", which goes to checkout.)
 */
export async function resumePlan() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = prof?.stripe_customer_id
  let resumed = 0
  if (customerId) {
    try {
      resumed = await resumeEndingSubscriptions(getStripe(), customerId)
    } catch (e) {
      console.error('[resumePlan] resume failed', e instanceof Error ? e.message : e)
    }
  }
  if (resumed > 0) {
    redirect('/dashboard?hosting=resumed')
  }
  await openBillingPortal()
  redirect('/dashboard')
}

/**
 * Plans page "Switch to <step>" (hosting ladder): move the customer's ONE live hosting plan to a
 * step. Upgrades are immediate and prorated (charged now; a failed card changes nothing); downgrades
 * start at the next billing date (subscription schedule). See src/lib/stripe/change-plan.ts.
 * Grandfathered plans move only here, when the customer picks a step. Steps with sellable=false are
 * refused here (server), except "keep" for a customer already on one.
 *
 * Entitlements: this action never writes them. If the profile has never been synced by the webhook,
 * it is synced from Stripe BEFORE the move (so perks keep coming from the snapshot); afterwards only
 * the customer.subscription.updated webhook changes plan_step and perks.
 */
export type ChangeHostingPlanResult = { ok: boolean; message: string; code?: 'stale_preview' }

/**
 * Upgrade confirm preview (Aria, Oct 3 1:34 PM; Lina §3a). Signed in, rate limited per user, and
 * only ever about the caller's own subscription (found from their profile's Stripe customer; nothing
 * about the subscription comes from the browser). Read-only: invoices.createPreview at a
 * server-generated proration_date, which the browser sends back with Confirm. The proration_date is
 * returned on every failure too, so the fallback confirm ("We'll charge the difference today")
 * still charges at the time the customer looked.
 */
export type PlanPreviewResponse =
  | { ok: true; prorationDate: number; amountDueCents: number; nextAmountCents: number; nextDate: string | null }
  | { ok: false; reason: 'not_upgrade' | 'rate_limited' | 'preview_failed' | 'unavailable'; prorationDate: number | null }

export async function previewPlanChange(planStep: string): Promise<PlanPreviewResponse> {
  const step = resolvePlanStep(planStep)
  if (!step) return { ok: false, reason: 'unavailable', prorationDate: null }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/plans')
  const prorationDate = Math.floor(Date.now() / 1000)
  if (!(await rateCheck(PLAN_PREVIEW_LIMIT, user.id))) return { ok: false, reason: 'rate_limited', prorationDate }
  const { data: prof } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  const customerId = prof?.stripe_customer_id
  if (!customerId) return { ok: false, reason: 'unavailable', prorationDate: null }
  try {
    const live = (await listLiveSubscriptions(customerId)).filter((s) => s.status === 'active' || s.status === 'trialing')
    if (live.length !== 1) return { ok: false, reason: 'unavailable', prorationDate: null }
    const stripe = getStripe()
    const p = await previewPlanStepChange({ stripe, priceIdFor: (id) => getStepPriceId(id, stripe) }, live[0], step.id, prorationDate)
    if (!p.ok) return { ok: false, reason: p.code === 'not_upgrade' ? 'not_upgrade' : 'unavailable', prorationDate: null }
    return {
      ok: true,
      prorationDate: p.prorationDate,
      amountDueCents: p.amountDueCents,
      nextAmountCents: p.nextAmountCents,
      nextDate: p.nextBillingAt ? formatPlanEndDate(new Date(p.nextBillingAt)) : null,
    }
  } catch (e) {
    console.error('[previewPlanChange] failed', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'preview_failed', prorationDate }
  }
}

export async function changeHostingPlan(planStep: string, prorationDate?: number): Promise<ChangeHostingPlanResult> {
  const step = resolvePlanStep(planStep)
  if (!step) return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
  if (prorationDate !== undefined && (typeof prorationDate !== 'number' || !Number.isSafeInteger(prorationDate))) {
    return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/plans')

  const { data: prof } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  const customerId = prof?.stripe_customer_id
  if (!customerId) return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
  try {
    const live = (await listLiveSubscriptions(customerId)).filter((s) => s.status === 'active' || s.status === 'trialing')
    if (live.length !== 1) return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
    const stripe = getStripe()
    const snapshot = await loadPlanSnapshotRow(supabase, user.id)
    if (!snapshot?.plan_step_synced_at) {
      await syncPlanSnapshotForCustomer(stripe, customerId)
    }
    const r = await changePlanStep({ stripe, priceIdFor: (id) => getStepPriceId(id, stripe) }, live[0], step.id, { prorationDate, userId: user.id })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/plans')
    if (r.ok && r.kind === 'upgraded') return { ok: true, message: CHANGE_PLAN_UPGRADED(step.name) }
    if (r.ok && r.kind === 'scheduled') return { ok: true, message: CHANGE_PLAN_SCHEDULED(step.name, formatPlanEndDate(new Date(r.effectiveAt))) }
    if (r.ok) return { ok: true, message: CHANGE_PLAN_UNCHANGED }
    if (r.code === 'ending') return { ok: false, message: CHANGE_PLAN_ENDING }
    if (r.code === 'not_sellable') return { ok: false, message: STEP_NOT_SELLABLE_MESSAGE(step.name) }
    if (r.code === 'stale_preview') return { ok: false, message: UPGRADE_PREVIEW_EXPIRED, code: 'stale_preview' }
    if (r.code === 'in_progress') return { ok: false, message: UPGRADE_IN_PROGRESS }
    if (r.code === 'payment_failed') {
      return { ok: false, message: r.pendingRestored === false ? CHANGE_PLAN_PAYMENT_FAILED_PENDING_LOST : CHANGE_PLAN_PAYMENT_FAILED }
    }
    return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
  } catch (e) {
    console.error('[changeHostingPlan] failed', e instanceof Error ? e.message : e)
    return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
  }
}

/**
 * Cancel page, when a downgrade is pending: cancel at period end in the app. Stripe refuses
 * cancel_at_period_end on a subscription a schedule manages, so the pending downgrade is released
 * first (src/lib/stripe/change-plan.ts cancelPlanAtPeriodEnd). Without a pending downgrade the
 * cancel page keeps using the billing portal.
 */
export async function cancelHostingAtPeriodEnd(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/cancel')
  const { data: prof } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  const customerId = prof?.stripe_customer_id
  let done = false
  if (customerId) {
    try {
      const live = (await listLiveSubscriptions(customerId)).filter((s) => s.status === 'active' || s.status === 'trialing')
      if (live.length === 1) {
        const r = await cancelPlanAtPeriodEnd(getStripe(), live[0])
        done = r.ok
      }
    } catch (e) {
      console.error('[cancelHostingAtPeriodEnd] failed', e instanceof Error ? e.message : e)
    }
  }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/cancel')
  revalidatePath('/dashboard/plans')
  redirect(done ? '/dashboard/cancel?canceled=1' : '/dashboard/cancel?cancel_error=1')
}
