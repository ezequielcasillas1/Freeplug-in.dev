import Link from 'next/link'
import { HostingCheckoutCard } from '@/components/plans/HostingCheckoutCard'
import { MaintenancePlanCard } from '@/components/plans/MaintenancePlanCard'
import { isPlansCheckoutAllowed } from '@/lib/dashboard/plans-eligibility'
import { createClient } from '@/lib/supabase/server'
import { describeLiveSubscriptions, formatPlanEndDate, formatShortPlanDate, listLiveSubscriptions } from '@/lib/stripe/active-subscription'
import type { PlanStepId } from '@/lib/plans/ladder'
import { getUserEntitlements } from '@/lib/plans/user-entitlements'
import { pendingPlanChange, subscriptionMonthlyCents, subscriptionTipDollars } from '@/lib/stripe/change-plan'
import { subscriptionPeriodEnd } from '@/lib/stripe/subscription-dates'
import { getStripe } from '@/lib/stripe/server'
import { changeHostingPlan, changeTipAction, previewPlanChange, previewTipChangeAction, updatePaymentMethod } from '../billing-actions'
import { BILLING_PENDING_NOTICE, BILLING_UNAVAILABLE, CARD_UPDATED_NOTICE, DASHBOARD_PLANS_INTRO } from '@/lib/plans/ladder-copy'
import { stepById } from '@/lib/plans/ladder'
import { BillingTools } from '@/components/plans/BillingTools'
import { listInvoicesForCustomer, type InvoiceRow } from '@/lib/stripe/billing-routing'

type Props = { searchParams: Promise<{ billing?: string; card?: string }> }

/** Invoice list for the Billing section; null when Stripe can't be reached. */
async function loadInvoices(customerId: string): Promise<InvoiceRow[] | null> {
  try {
    return await listInvoicesForCustomer(getStripe(), customerId)
  } catch (e) {
    console.error('[plans] invoice list failed', e instanceof Error ? e.message : e)
    return null
  }
}

function BillingNotices({ billing, card, pendingChange }: { billing?: string; card?: string; pendingChange: { stepId: PlanStepId; date: string } | null }) {
  return (
    <>
      {billing === 'pending' && pendingChange ? (
        <div role="status" data-testid="billing-pending-notice" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 max-w-2xl mb-6">
          {BILLING_PENDING_NOTICE(stepById(pendingChange.stepId).name, pendingChange.date)}
        </div>
      ) : null}
      {billing === 'unavailable' ? (
        <div role="status" data-testid="billing-unavailable" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 max-w-2xl mb-6">
          {BILLING_UNAVAILABLE}
        </div>
      ) : null}
      {card === 'updated' ? (
        <p role="status" data-testid="card-updated" className="text-sm text-green-800 mb-6">{CARD_UPDATED_NOTICE}</p>
      ) : null}
    </>
  )
}

export default async function DashboardPlansPage({ searchParams }: Props) {
  const { billing, card } = (await searchParams) ?? {}
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const allowed =
    user != null && (await isPlansCheckoutAllowed(supabase, user.id))

  if (!allowed) {
    // A Stripe customer still gets the card update and invoices (Manage billing can land here).
    const { data: gated } = user
      ? await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
      : { data: null }
    const gatedInvoices = gated?.stripe_customer_id ? await loadInvoices(gated.stripe_customer_id) : undefined
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Plans</h1>
        <p className="text-gray-600 mb-6 max-w-2xl">
          After you submit a website request, you can choose monthly hosting here. Maintenance stays
          quote-first — describe work on the request form.
        </p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 max-w-xl mb-8">
          Submit your business details so we can review your site and Google Business presence. Then
          hosting checkout will be available.
        </div>
        <Link
          href="/dashboard/request-website"
          className="inline-flex rounded-lg bg-[#ba3d3d] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95"
        >
          Request a website
        </Link>
        {gatedInvoices !== undefined ? (
          <>
            <div className="mt-8"><BillingNotices billing={billing} card={card} pendingChange={null} /></div>
            <BillingTools updateCardAction={updatePaymentMethod} invoices={gatedInvoices} />
          </>
        ) : null}
      </div>
    )
  }

  // A customer with a live plan gets Manage billing instead of a second checkout.
  let currentPlanLines: string[] = []
  let currentStepId: PlanStepId | null = null
  let pendingChange: { stepId: PlanStepId; date: string } | null = null
  let currentMonthlyCents: number | null = null
  let renewalDate: string | null = null
  let renewalDateShort: string | null = null
  let currentTipDollars = 0
  const { data: prof } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user!.id)
    .single()
  if (prof?.stripe_customer_id) {
    try {
      currentPlanLines = await describeLiveSubscriptions(prof.stripe_customer_id)
      if (currentPlanLines.length > 0) {
        // Current step = the webhook-written snapshot (changes when Stripe's webhook lands).
        const { entitlements: ent } = await getUserEntitlements(supabase, user!.id, prof.stripe_customer_id)
        currentStepId = ent.step && !ent.legacy ? ent.step.id : null
        // A downgrade waiting for the next billing date (subscription schedule), with its date.
        const live = (await listLiveSubscriptions(prof.stripe_customer_id)).filter(
          (s) => s.status === 'active' || s.status === 'trialing'
        )
        if (live.length === 1) {
          // Button direction and "Switch to X on <date>" (Lina §3a) use what the plan costs now.
          currentMonthlyCents = subscriptionMonthlyCents(live[0])
          // The tipping system: the tip item on the live subscription (never part of the plan price).
          currentTipDollars = subscriptionTipDollars(live[0])
          const end = subscriptionPeriodEnd(live[0])
          renewalDate = end ? formatPlanEndDate(end) : null
          renewalDateShort = end ? formatShortPlanDate(end) : null
          if (live[0].schedule) {
            const p = await pendingPlanChange(getStripe(), live[0])
            if (p) pendingChange = { stepId: p.step, date: formatPlanEndDate(new Date(p.effectiveAt)) }
          }
        }
      }
    } catch (e) {
      // Stripe unreachable: show the normal card; the checkout API still refuses a second plan.
      console.error('[plans] live plan lookup failed', e)
    }
  }

  const invoices = prof?.stripe_customer_id ? await loadInvoices(prof.stripe_customer_id) : undefined

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Plans</h1>
      <p className="text-gray-600 mb-8 max-w-2xl">
        {DASHBOARD_PLANS_INTRO}
      </p>
      <BillingNotices billing={billing} card={card} pendingChange={pendingChange} />
      {/* Lina §1: the ladder full width (columns from lg), Maintenance below it, then Billing. */}
      <div className="space-y-8 max-w-4xl">
        <HostingCheckoutCard
          embedded
          layout="columns"
          stickyOnPhone
          currentPlanLines={currentPlanLines}
          currentStepId={currentStepId}
          currentMonthlyCents={currentMonthlyCents}
          renewalDate={renewalDate}
          renewalDateShort={renewalDateShort}
          onChangePlan={changeHostingPlan}
          onPreviewChange={previewPlanChange}
          pendingChange={pendingChange}
          currentTipDollars={currentTipDollars}
          onPreviewTip={previewTipChangeAction}
          onChangeTip={changeTipAction}
        />
        <MaintenancePlanCard
          embedded
          ctaHref="/dashboard/request-website?focus=maintenance"
        />
      </div>
      {invoices !== undefined ? <BillingTools updateCardAction={updatePaymentMethod} invoices={invoices} /> : null}
    </div>
  )
}
