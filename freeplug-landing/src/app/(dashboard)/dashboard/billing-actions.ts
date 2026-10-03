'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { appBaseUrl } from '@/lib/stripe/config'
import { getStripe } from '@/lib/stripe/server'
import { resumeEndingSubscriptions } from '@/lib/stripe/resume-hosting'
import { billingPortalSessionParams } from '@/lib/stripe/portal'
import { revalidatePath } from 'next/cache'
import { resolvePlanStep } from '@/lib/plans/ladder'
import { changePlanStep } from '@/lib/stripe/change-plan'
import { getStepPriceId } from '@/lib/stripe/prices'
import { formatPlanEndDate, listLiveSubscriptions } from '@/lib/stripe/active-subscription'
import {
  CHANGE_PLAN_ENDING,
  CHANGE_PLAN_PAYMENT_FAILED,
  CHANGE_PLAN_SCHEDULED,
  CHANGE_PLAN_UNAVAILABLE,
  CHANGE_PLAN_UNCHANGED,
  CHANGE_PLAN_UPGRADED,
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
  const session = await stripe.billingPortal.sessions.create(
    billingPortalSessionParams(customerId, `${appBaseUrl()}/dashboard`)
  )

  if (session.url) {
    redirect(session.url)
  }
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
 * step. Upgrades are immediate and prorated (charged now); downgrades start at the next billing
 * date (subscription schedule). See src/lib/stripe/change-plan.ts. Grandfathered plans move only
 * here, when the customer picks a step. The webhook then re-syncs profiles.plan_step.
 */
export async function changeHostingPlan(planStep: string): Promise<{ ok: boolean; message: string }> {
  const step = resolvePlanStep(planStep)
  if (!step) return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
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
    const r = await changePlanStep({ stripe, priceIdFor: (id) => getStepPriceId(id, stripe) }, live[0], step.id)
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/plans')
    if (r.ok && r.kind === 'upgraded') return { ok: true, message: CHANGE_PLAN_UPGRADED(step.name) }
    if (r.ok && r.kind === 'scheduled') return { ok: true, message: CHANGE_PLAN_SCHEDULED(step.name, formatPlanEndDate(new Date(r.effectiveAt))) }
    if (r.ok) return { ok: true, message: CHANGE_PLAN_UNCHANGED }
    if (r.code === 'ending') return { ok: false, message: CHANGE_PLAN_ENDING }
    if (r.code === 'payment_failed') return { ok: false, message: CHANGE_PLAN_PAYMENT_FAILED }
    return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
  } catch (e) {
    console.error('[changeHostingPlan] failed', e instanceof Error ? e.message : e)
    return { ok: false, message: CHANGE_PLAN_UNAVAILABLE }
  }
}
