import Link from 'next/link'
import { HostingCheckoutCard } from '@/components/plans/HostingCheckoutCard'
import { MaintenancePlanCard } from '@/components/plans/MaintenancePlanCard'
import { isPlansCheckoutAllowed } from '@/lib/dashboard/plans-eligibility'
import { createClient } from '@/lib/supabase/server'
import { describeLiveSubscriptions, formatPlanEndDate, listLiveSubscriptions } from '@/lib/stripe/active-subscription'
import type { PlanStepId } from '@/lib/plans/ladder'
import { getUserEntitlements } from '@/lib/plans/user-entitlements'
import { pendingPlanChange } from '@/lib/stripe/change-plan'
import { getStripe } from '@/lib/stripe/server'
import { changeHostingPlan } from '../billing-actions'
import { DASHBOARD_PLANS_INTRO } from '@/lib/plans/ladder-copy'

export default async function DashboardPlansPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const allowed =
    user != null && (await isPlansCheckoutAllowed(supabase, user.id))

  if (!allowed) {
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
      </div>
    )
  }

  // A customer with a live plan gets Manage billing instead of a second checkout.
  let currentPlanLines: string[] = []
  let currentStepId: PlanStepId | null = null
  let pendingChange: { stepId: PlanStepId; date: string } | null = null
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
        if (live.length === 1 && live[0].schedule) {
          const p = await pendingPlanChange(getStripe(), live[0])
          if (p) pendingChange = { stepId: p.step, date: formatPlanEndDate(new Date(p.effectiveAt)) }
        }
      }
    } catch (e) {
      // Stripe unreachable: show the normal card; the checkout API still refuses a second plan.
      console.error('[plans] live plan lookup failed', e)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Plans</h1>
      <p className="text-gray-600 mb-8 max-w-2xl">
        {DASHBOARD_PLANS_INTRO}
      </p>
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
        <HostingCheckoutCard
          embedded
          currentPlanLines={currentPlanLines}
          currentStepId={currentStepId}
          onChangePlan={changeHostingPlan}
          pendingChange={pendingChange}
        />
        <MaintenancePlanCard
          embedded
          ctaHref="/dashboard/request-website?focus=maintenance"
        />
      </div>
    </div>
  )
}
