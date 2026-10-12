'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { appBaseUrl } from '@/lib/stripe/config'
import { getStripe } from '@/lib/stripe/server'
import { sendAddonRefundNoticeOnce } from '@/lib/email/addon-refund-notice'
import { recordRemovalOwedNow, removalOwedStore, resumeRemovalOwed, sendRemovalOwedUnrecordedAlert } from '@/lib/stripe/addon-removal-owed-server'
import { resumeEndingSubscriptions, resumeOutcomeFromLive, type ResumeOutcome } from '@/lib/stripe/resume-hosting'
import { PortalNotConfiguredError } from '@/lib/stripe/portal'
import { findScheduledSubscription, paymentMethodUpdateSessionParams, PLANS_CARD_RETURN_PATH, PLANS_PENDING_BILLING_PATH, RESUME_BUSY_PATH, RESUME_FAILED_PATH, RESUMED_PATH, RESUMED_REMOVAL_OWED_FOCUS_PATH, RESUMED_REMOVAL_OWED_PATH } from '@/lib/stripe/billing-routing'
import { revalidatePath } from 'next/cache'
import { resolvePlanStep } from '@/lib/plans/ladder'
import { cancelPlanAtPeriodEnd, changeAddon, changePlanStep, changeTip, previewAddonChange, previewPlanStepChange, previewTipChange, type AddonAction, type AddonChangeRefusal, type TipChangeRefusal } from '@/lib/stripe/change-plan'
import { PLAN_PREVIEW_LIMIT, rateCheck } from '@/lib/rate-limit'
import { getAddonPriceId, getStepPriceId, getTipPriceId } from '@/lib/stripe/prices'
import { addonById, type AddonId } from '@/lib/plans/ladder'
import { ADDON_ERROR, ADDON_NAMES, ADDON_PRICE_UNCONFIRMED, ADDON_PENDING_REMOVAL, ADDON_TURN_OFF_FIRST, ADDONS_LEGACY_NOTE, addonFinishing, addonKeepDone, addonOffDone, addonOnDone, addonPaymentFailed, addonRefunded, addonRefundFailed, addonsLockedBySwitch } from '@/lib/plans/ladder-copy'
import { formatPlanEndDate, listLiveSubscriptions } from '@/lib/stripe/active-subscription'
import { loadPlanSnapshotRow } from '@/lib/plans/plan-snapshot'
import { syncPlanSnapshotForCustomer } from '@/lib/stripe/sync-checkout-customer'
import { withPlanChangeLock } from '@/lib/plans/plan-change-lock'
import { planChangeLockStore } from '@/lib/plans/plan-change-lock-server'
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
  TIP_CHANGE_PENDING,
  TIP_CHANGE_UNAVAILABLE,
  TIP_CHANGED,
  TIP_IN_PROGRESS,
  renewalLineText,
  renewalCarriedLine,
  TIP_NOT_FOR_PLAN,
  TIP_OUT_OF_RANGE,
  TIP_CHANGE_ENDING,
} from '@/lib/plans/ladder-copy'

/**
 * Manage billing (Aria, Oct 3 4:05 PM): a card-only portal session (payment_method_update flow on the
 * dedicated configuration) that returns to the Plans page. Never the full portal: without
 * STRIPE_PORTAL_CONFIGURATION_ID, or if Stripe fails, the Plans page shows "billing unavailable".
 * While a plan switch is ahead, the Plans page notice instead (Aria, Oct 3 12:56 / 3:43 PM).
 */
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

  redirect((await cardOnlyPortalUrl(customerId)) ?? '/dashboard/plans?billing=unavailable')
}

/** The card-only portal session URL, or null (no configuration id, or Stripe failed). */
async function cardOnlyPortalUrl(customerId: string): Promise<string | null> {
  try {
    const session = await getStripe().billingPortal.sessions.create(
      paymentMethodUpdateSessionParams(customerId, `${appBaseUrl()}${PLANS_CARD_RETURN_PATH}`)
    )
    return session.url ?? null
  } catch (e) {
    if (e instanceof PortalNotConfiguredError) console.error('[billing] portal refused:', e.message)
    else console.error('[billing] card update session failed', e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * Plans page "Update card": the same card-only portal session (no portal navigation; returns to the
 * Plans page when done). Same with or without a planned switch.
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

  redirect((await cardOnlyPortalUrl(customerId)) ?? '/dashboard/plans?billing=unavailable')
}

/**
 * Dashboard / cancel page "Resume plan" (shown while hosting is canceled but the paid period is still
 * running): clears cancel_at_period_end on the existing subscription, so there is no second plan and
 * no new charge. Runs under the change-plan lock (Aria 4:05 PM). If nothing could be resumed, an
 * error with the support contact; never the billing portal. (When hosting has already ended, the
 * dashboard shows "Restart hosting", which goes to checkout.)
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
  let outcome: ResumeOutcome = 'failed'
  let resumedNow = false
  let removalOwed = false
  if (customerId) {
    let lockHeld = false
    try {
      const lock = await withPlanChangeLock(lockStore(), user.id, () =>
        resumeEndingSubscriptions(getStripe(), customerId, new Date(), { userId: user.id, onRemovalOwed: recordRemovalOwedNow('resume'), alertUnrecorded: sendRemovalOwedUnrecordedAlert })
      )
      if (lock.ok && lock.value > 0) {
        outcome = 'resumed'
        resumedNow = true
      } else if (!lock.ok) {
        lockHeld = lock.code === 'in_progress'
        console.error('[resumePlan] lock', lock.code)
      }
    } catch (e) {
      console.error('[resumePlan] resume failed', e instanceof Error ? e.message : e)
    }
    // Vera B1/B2: nothing resumed here (double click, second tab, lock busy, or an error). Ask Stripe
    // what is true now before showing a failure: already resumed -> the success state.
    if (outcome !== 'resumed') {
      try {
        outcome = resumeOutcomeFromLive(await listLiveSubscriptions(customerId), lockHeld)
      } catch (e) {
        console.error('[resumePlan] re-read failed', e instanceof Error ? e.message : e)
      }
    }
    // Aria 10:09 (option A): resumed, but an add-on removal is still owed -> the Plans box. This click
    // resumed it: land on the box; a later click (already resumed): scroll to the box and focus it.
    if (outcome === 'resumed') {
      try {
        const live = await listLiveSubscriptions(customerId)
        removalOwed = (await resumeRemovalOwed(live.map((s) => s.id))).addons.length > 0
      } catch (e) {
        console.error('[resumePlan] owed removal read failed', e instanceof Error ? e.message : e)
      }
    }
  }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/cancel')
  revalidatePath('/dashboard/plans')
  if (outcome === 'resumed' && removalOwed) redirect(resumedNow ? RESUMED_REMOVAL_OWED_PATH : RESUMED_REMOVAL_OWED_FOCUS_PATH)
  redirect(outcome === 'resumed' ? RESUMED_PATH : outcome === 'busy' ? RESUME_BUSY_PATH : RESUME_FAILED_PATH)
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
export type ChangeHostingPlanResult = { ok: boolean; message: string; code?: 'stale_preview' | 'in_progress' }

/** The change-plan lock store (service role; migration 20261003210000; lib/plans/plan-change-lock-server.ts). */
const lockStore = planChangeLockStore

/**
 * Upgrade confirm preview (Aria, Oct 3 1:34 PM; Lina §3a). Signed in, rate limited per user, and
 * only ever about the caller's own subscription (found from their profile's Stripe customer; nothing
 * about the subscription comes from the browser). Read-only: invoices.createPreview at a
 * server-generated proration_date, which the browser sends back with Confirm. The proration_date is
 * returned on every failure too, so the fallback confirm ("We'll charge the difference today")
 * still charges at the time the customer looked.
 */
export type PlanPreviewResponse =
  | { ok: true; prorationDate: number; amountDueCents: number; nextAmountCents: number; nextDate: string | null; tipDollars?: number; addons?: AddonId[] }
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
      tipDollars: p.tipDollars,
      addons: p.addons,
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
  // Change-plan lock (Aria): claimed before ANY Stripe call, released in finally (60 s expiry). A
  // second change while it is held gets UPGRADE_IN_PROGRESS and never reaches Stripe. Fails closed.
  let lock
  try {
    lock = await withPlanChangeLock(lockStore(), user.id, () => runHostingPlanChange(supabase, user.id, customerId, step, prorationDate))
  } catch (e) {
    console.error('[changeHostingPlan] failed', e instanceof Error ? e.message : e)
    return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
  }
  if (!lock.ok) {
    return lock.code === 'in_progress' ? { ok: false, message: UPGRADE_IN_PROGRESS, code: 'in_progress' } : { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
  }
  return lock.value
}

/** The plan change itself, run while holding the change-plan lock. */
async function runHostingPlanChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  customerId: string,
  step: NonNullable<ReturnType<typeof resolvePlanStep>>,
  prorationDate: number | undefined
): Promise<ChangeHostingPlanResult> {
  try {
    const live = (await listLiveSubscriptions(customerId)).filter((s) => s.status === 'active' || s.status === 'trialing')
    if (live.length !== 1) return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
    const stripe = getStripe()
    const snapshot = await loadPlanSnapshotRow(supabase, userId)
    if (!snapshot?.plan_step_synced_at) {
      await syncPlanSnapshotForCustomer(stripe, customerId)
    }
    // L-1 (Aria 9:57): a pending add-on removal that can't be put back after the upgrade is saved as owed + alerted.
    const r = await changePlanStep({ stripe, priceIdFor: (id) => getStepPriceId(id, stripe), onRemovalOwed: recordRemovalOwedNow('upgrade') }, live[0], step.id, { prorationDate, userId })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/plans')
    if (r.ok && r.kind === 'upgraded') return { ok: true, message: CHANGE_PLAN_UPGRADED(step.name) }
    if (r.ok && r.kind === 'scheduled') return { ok: true, message: CHANGE_PLAN_SCHEDULED(step.name, formatPlanEndDate(new Date(r.effectiveAt))) }
    if (r.ok) return { ok: true, message: CHANGE_PLAN_UNCHANGED }
    if (r.code === 'ending') return { ok: false, message: CHANGE_PLAN_ENDING }
    if (r.code === 'not_sellable') return { ok: false, message: STEP_NOT_SELLABLE_MESSAGE(step.name) }
    if (r.code === 'addons_over_cap') return { ok: false, message: ADDON_TURN_OFF_FIRST }
    if (r.code === 'stale_preview') return { ok: false, message: UPGRADE_PREVIEW_EXPIRED, code: 'stale_preview' }
    if (r.code === 'in_progress') return { ok: false, message: UPGRADE_IN_PROGRESS, code: 'in_progress' }
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
 * Cancel page "Cancel my plan": the ONLY cancel (Aria, Oct 3 4:05 PM; the portal's cancel is off).
 * Cancel at period end in the app, under the change-plan lock. Stripe refuses cancel_at_period_end on
 * a subscription a schedule manages, so an attached schedule is released first, inside the lock
 * (src/lib/stripe/change-plan.ts cancelPlanAtPeriodEnd).
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
      const lock = await withPlanChangeLock(lockStore(), user.id, async () => {
        const live = (await listLiveSubscriptions(customerId)).filter((s) => s.status === 'active' || s.status === 'trialing')
        if (live.length !== 1) return false
        return (await cancelPlanAtPeriodEnd(getStripe(), live[0])).ok
      })
      if (lock.ok) done = lock.value
      else console.error('[cancelHostingAtPeriodEnd] lock', lock.code)
    } catch (e) {
      console.error('[cancelHostingAtPeriodEnd] failed', e instanceof Error ? e.message : e)
    }
  }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/cancel')
  revalidatePath('/dashboard/plans')
  redirect(done ? '/dashboard/cancel?canceled=1' : '/dashboard/cancel?cancel_error=1')
}

// ------------------------------------------------------------------ the tipping system: tip changes

export type TipPreviewResponse =
  /** confirmId: one per preview, sent back with that Confirm (idempotency per Confirm, Vera B2). */
  | { ok: true; tipDollars: number; nextAmountCents: number; nextDate: string | null; confirmId: string; carriedCents?: number }
  | { ok: false; message: string }
/** carriedNote: Sable's gray line under the next-bill line while a carried small amount is pending (Aria 2:40 PM). */
export type ChangeTipResponse = { ok: boolean; message: string; carriedNote?: string }

function tipRefusalMessage(code: TipChangeRefusal | 'mismatch' | 'rate_limited'): string {
  if (code === 'pending_change') return TIP_CHANGE_PENDING
  if (code === 'ending') return TIP_CHANGE_ENDING
  if (code === 'no_tip_plan') return TIP_NOT_FOR_PLAN
  if (code === 'out_of_range') return TIP_OUT_OF_RANGE
  return TIP_CHANGE_UNAVAILABLE
}

async function ownLiveSubscription(): Promise<{ userId: string; sub: Awaited<ReturnType<typeof listLiveSubscriptions>>[number] } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/plans')
  const { data: prof } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  const customerId = prof?.stripe_customer_id
  if (!customerId) return null
  const live = (await listLiveSubscriptions(customerId)).filter((s) => s.status === 'active' || s.status === 'trialing')
  return live.length === 1 ? { userId: user.id, sub: live[0] } : null
}

/**
 * Plans page tip box: "Your next bill will be $X on <date>." for a new tip (read-only Stripe preview with
 * proration none). Signed in, rate limited, the caller's own subscription only; the amount is
 * re-checked against the step's range on the server.
 */
export async function previewTipChangeAction(tipDollars: number): Promise<TipPreviewResponse> {
  try {
    const own = await ownLiveSubscription()
    if (!own) return { ok: false, message: TIP_CHANGE_UNAVAILABLE }
    if (!(await rateCheck(PLAN_PREVIEW_LIMIT, own.userId))) return { ok: false, message: tipRefusalMessage('rate_limited') }
    const stripe = getStripe()
    const p = await previewTipChange({ stripe, tipPriceId: () => getTipPriceId(stripe) }, own.sub, tipDollars)
    if (!p.ok) return { ok: false, message: tipRefusalMessage(p.code) }
    return {
      ok: true,
      tipDollars: p.tipDollars,
      nextAmountCents: p.nextAmountCents,
      nextDate: p.nextBillingAt ? formatPlanEndDate(new Date(p.nextBillingAt)) : null,
      confirmId: crypto.randomUUID(),
      carriedCents: p.carriedCents,
    }
  } catch (e) {
    console.error('[previewTipChange] failed', e instanceof Error ? e.message : e)
    return { ok: false, message: TIP_CHANGE_UNAVAILABLE }
  }
}

/**
 * Plans page tip box Confirm: the new tip starts with the next bill (proration none, nothing charged
 * today). Runs under the same change-plan lock as a plan switch, so a tip change and a switch can't
 * interleave (e.g. a tip added while an upgrade is removing it).
 */
export async function changeTipAction(tipDollars: number, confirmId?: string): Promise<ChangeTipResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/plans')
  try {
    const lock = await withPlanChangeLock(lockStore(), user.id, () => runTipChange(tipDollars, confirmId))
    // A second tip change while this one holds the lock (double-click, second tab): Sable's tip line, not
    // the plan-change one (round 5b).
    if (!lock.ok) return { ok: false, message: lock.code === 'in_progress' ? TIP_IN_PROGRESS : TIP_CHANGE_UNAVAILABLE }
    return lock.value
  } catch (e) {
    console.error('[changeTip] failed', e instanceof Error ? e.message : e)
    return { ok: false, message: TIP_CHANGE_UNAVAILABLE }
  }
}

async function runTipChange(tipDollars: number, confirmId?: string): Promise<ChangeTipResponse> {
  try {
    const own = await ownLiveSubscription()
    if (!own) return { ok: false, message: TIP_CHANGE_UNAVAILABLE }
    const stripe = getStripe()
    const r = await changeTip({ stripe, tipPriceId: () => getTipPriceId(stripe) }, own.sub, tipDollars, { userId: own.userId, confirmId })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/plans')
    if (!r.ok) return { ok: false, message: tipRefusalMessage(r.code) }
    const date = r.nextBillingAt ? formatPlanEndDate(new Date(r.nextBillingAt)) : null
    // The tip box shows "Saved." + the next-bill line the customer confirmed; this is the fallback.
    return {
      ok: true,
      message: TIP_CHANGED(renewalLineText(r.nextAmountCents, date)),
      ...(r.carriedCents && r.carriedCents > 0 ? { carriedNote: renewalCarriedLine(r.carriedCents) } : {}),
    }
  } catch (e) {
    console.error('[changeTip] failed', e instanceof Error ? e.message : e)
    return { ok: false, message: TIP_CHANGE_UNAVAILABLE }
  }
}

// ------------------------------------------------------------------ add-ons (Oct 4): on / off / keep

export type AddonPreviewResponse =
  | {
      ok: true
      action: 'on'
      prorationDate: number
      /** The real amount today (Stripe preview, account credit applied); 0 = credit covers it. */
      amountDueCents: number
      /** The add-on's full monthly price. */
      fullCents: number
      /** Vera M-1: a small amount carried from the last change, included in amountDueCents (0 or absent = none). */
      carriedCents?: number
      nextAmountCents: number
      nextDate: string | null
      tipDollarsNow: number
      tipDollarsAfter: number
    }
  | { ok: true; action: 'off' | 'keep'; endDate: string | null; nextAmountCents: number; nextDate: string | null }
  /**
   * fallback: turning on, the Stripe preview failed (not a refusal): the confirm still opens with "We'll
   * charge up to {price} today…" and Confirm sends this prorationDate (as the upgrade confirm does).
   */
  | { ok: false; message: string; prorationDate: number | null; fallback?: { priceCents: number; nextAmountCents: number | null; nextDate: string | null } }
export type ChangeAddonResponse = { ok: boolean; message: string; code?: 'tip_drop_needed' | 'stale_preview' | 'in_progress' | 'finishing'; tipDollars?: number }

function addonRefusalMessage(
  code: AddonChangeRefusal | 'in_progress' | 'mismatch' | 'payment_failed',
  addonId: AddonId,
  switchAt?: string | null
): string {
  if (code === 'pending_switch') return addonsLockedBySwitch(switchAt ? formatPlanEndDate(new Date(switchAt)) : null)
  if (code === 'pending_addons') return ADDON_PENDING_REMOVAL
  if (code === 'over_cap') return ADDON_TURN_OFF_FIRST
  if (code === 'price_mismatch') return ADDON_PRICE_UNCONFIRMED
  if (code === 'no_addon_plan') return ADDONS_LEGACY_NOTE
  if (code === 'ending') return CHANGE_PLAN_ENDING
  if (code === 'stale_preview') return UPGRADE_PREVIEW_EXPIRED
  if (code === 'in_progress') return UPGRADE_IN_PROGRESS
  if (code === 'payment_failed') return addonPaymentFailed(ADDON_NAMES[addonId])
  return ADDON_ERROR
}

const parseAddonAction = (v: unknown): AddonAction | null => (v === 'on' || v === 'off' || v === 'keep' ? v : null)

/**
 * Plans page add-on card: read-only preview. on = the add-on's full monthly price (charged now,
 * never prorated; Aria Oct 4) + the tip it would drop to (Starter), stamped with a server time sent
 * back with Confirm; off = the date it
 * ends. Signed in, rate limited, the caller's own subscription only; nothing about the subscription
 * comes from the browser.
 */
export async function previewAddonChangeAction(addonId: string, action: string): Promise<AddonPreviewResponse> {
  const addon = addonById(addonId)
  const act = parseAddonAction(action)
  if (!addon || !act) return { ok: false, message: ADDON_ERROR, prorationDate: null }
  const prorationDate = Math.floor(Date.now() / 1000)
  try {
    const own = await ownLiveSubscription()
    if (!own) return { ok: false, message: ADDON_ERROR, prorationDate: null }
    if (!(await rateCheck(PLAN_PREVIEW_LIMIT, own.userId))) return { ok: false, message: ADDON_ERROR, prorationDate }
    const stripe = getStripe()
    const p = await previewAddonChange({ stripe, addonPriceIdFor: (id) => getAddonPriceId(id, stripe) }, own.sub, addon.id, act, prorationDate)
    if (!p.ok) return { ok: false, message: addonRefusalMessage(p.code, addon.id, p.switchAt), prorationDate: null }
    const nextDate = p.nextBillingAt ? formatPlanEndDate(new Date(p.nextBillingAt)) : null
    if (p.action === 'on') {
      return {
        ok: true,
        action: 'on',
        prorationDate: p.prorationDate,
        amountDueCents: p.amountDueCents,
        fullCents: p.fullCents,
        carriedCents: p.carriedCents,
        nextAmountCents: p.nextAmountCents,
        nextDate,
        tipDollarsNow: p.tipDollarsNow,
        tipDollarsAfter: p.tipDollarsAfter,
      }
    }
    return { ok: true, action: p.action, endDate: p.effectiveAt ? formatPlanEndDate(new Date(p.effectiveAt)) : null, nextAmountCents: p.nextAmountCents, nextDate }
  } catch (e) {
    console.error('[previewAddonChange] failed', e instanceof Error ? e.message : e)
    // Turning on: the confirm still opens with "up to" the full price (credit can only lower it); the
    // proration_date goes back so Confirm charges at the time the customer looked. The server re-checks
    // everything at Confirm (a tip drop it needs comes back as tip_drop_needed and is asked first).
    if (act === 'on') return { ok: false, message: ADDON_ERROR, prorationDate, fallback: { priceCents: addon.monthlyCents, nextAmountCents: null, nextDate: null } }
    return { ok: false, message: ADDON_ERROR, prorationDate: null }
  }
}

/**
 * Plans page add-on Confirm, under the change-plan lock (an add-on, a tip change and a plan switch
 * never interleave). on: charged now (always_invoice); a tip drop must be the one the customer
 * confirmed (`tipDropTo`, re-checked on the server). off: at the end of the billing period. keep:
 * undoes a planned removal.
 */
export async function changeAddonAction(addonId: string, action: string, opts: { prorationDate?: number; tipDropTo?: number } = {}): Promise<ChangeAddonResponse> {
  const addon = addonById(addonId)
  const act = parseAddonAction(action)
  if (!addon || !act) return { ok: false, message: ADDON_ERROR }
  if (opts.prorationDate !== undefined && (typeof opts.prorationDate !== 'number' || !Number.isSafeInteger(opts.prorationDate))) return { ok: false, message: ADDON_ERROR }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard/plans')
  try {
    const lock = await withPlanChangeLock(lockStore(), user.id, () => runAddonChange(addon.id, act, opts))
    if (!lock.ok) return { ok: false, message: lock.code === 'in_progress' ? UPGRADE_IN_PROGRESS : ADDON_ERROR, ...(lock.code === 'in_progress' ? { code: 'in_progress' as const } : {}) }
    return lock.value
  } catch (e) {
    console.error('[changeAddon] failed', e instanceof Error ? e.message : e)
    return { ok: false, message: ADDON_ERROR }
  }
}

async function runAddonChange(addonId: AddonId, action: AddonAction, opts: { prorationDate?: number; tipDropTo?: number }): Promise<ChangeAddonResponse> {
  try {
    const own = await ownLiveSubscription()
    if (!own) return { ok: false, message: ADDON_ERROR }
    const stripe = getStripe()
    const r = await changeAddon({ stripe, addonPriceIdFor: (id) => getAddonPriceId(id, stripe) }, own.sub, addonId, action, {
      prorationDate: opts.prorationDate,
      tipDropTo: opts.tipDropTo,
      userId: own.userId,
    })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/plans')
    const name = ADDON_NAMES[addonId]
    if (r.ok && r.kind === 'on') return { ok: true, message: addonOnDone(name) }
    if (r.ok && r.kind === 'kept') {
      // L-1: Keep it = the customer wants it; an owed removal for it is dropped (errors logged only).
      try {
        await removalOwedStore().keep(own.sub.id, addonId)
      } catch (e) {
        console.error('[changeAddon] could not clear an owed removal on keep', e instanceof Error ? e.message : e)
      }
      return { ok: true, message: addonKeepDone(name) }
    }
    if (r.ok) return { ok: true, message: addonOffDone(name, r.effectiveAt ? formatPlanEndDate(new Date(r.effectiveAt)) : null) }
    if (r.code === 'tip_drop_needed') return { ok: false, message: `${ADDON_NAMES[addonId]}: ${r.message}`, code: 'tip_drop_needed', tipDollars: r.tipDollars }
    if (r.code === 'stale_preview') return { ok: false, message: UPGRADE_PREVIEW_EXPIRED, code: 'stale_preview' }
    if (r.code === 'in_progress') return { ok: false, message: UPGRADE_IN_PROGRESS, code: 'in_progress' }
    if (r.code === 'not_applied') {
      if (!r.refunded) return { ok: false, message: addonRefundFailed(name) }
      // Aria 9:27: the email too (once per invoice; the invoice.paid webhook may also try, the ledger sends once).
      if (r.invoiceId) {
        await sendAddonRefundNoticeOnce(stripe, r.invoiceId).catch((e: unknown) => console.error('[changeAddon] refund notice failed', e instanceof Error ? e.message : e))
      }
      return { ok: false, message: addonRefunded(name, r.refundCardCents ?? 0, r.refundCreditCents ?? 0) }
    }
    // Paid, not on yet: the invoice.paid self-heal adds it (or refunds automatically).
    if (r.code === 'finishing') return { ok: false, message: addonFinishing(name), code: 'finishing' }
    return { ok: false, message: addonRefusalMessage(r.code, addonId, 'switchAt' in r ? r.switchAt : null) }
  } catch (e) {
    console.error('[changeAddon] failed', e instanceof Error ? e.message : e)
    return { ok: false, message: ADDON_ERROR }
  }
}
