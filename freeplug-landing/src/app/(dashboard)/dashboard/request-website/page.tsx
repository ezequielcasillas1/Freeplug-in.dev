import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE,
  closeBlockedPlanEndingMessage,
  getActiveSubscriptionStatus,
  type ActiveSubscriptionStatus,
} from '@/lib/stripe/active-subscription'
import { CANCEL_OPTIONS_LINK } from '@/lib/plans/ladder-copy'
import { CloseOpenRequestButton } from './CloseOpenRequestButton'
import { RequestWebsiteForm, type RequestWebsiteFormValues } from './RequestWebsiteForm'

// Pattern title (no locked title yet); pending Sable's review. Overrides "Dashboard | Freeplug".
export const metadata: Metadata = {
  title: 'Request a website | Freeplug',
}

type Props = {
  searchParams: Promise<{ focus?: string }>
}

export default async function RequestWebsitePage({ searchParams }: Props) {
  const q = await searchParams
  const focusMaintenance = q.focus === 'maintenance'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let openRequestStatus: 'submitted' | 'in_review' | null = null
  let defaultValues: RequestWebsiteFormValues | undefined
  if (user) {
    const { data: open } = await supabase
      .from('website_requests')
      .select('status, business_name, contact_phone, google_business_url, notes')
      .eq('user_id', user.id)
      .in('status', ['submitted', 'in_review'])
      .maybeSingle()
    if (open?.status === 'submitted' || open?.status === 'in_review') {
      openRequestStatus = open.status
      // Pre-fill the form with the open request so saving never blanks existing details.
      defaultValues = {
        business_name: open.business_name ?? '',
        contact_phone: open.contact_phone ?? '',
        google_business_url: open.google_business_url ?? '',
        notes: open.notes ?? '',
      }
    }
  }

  // Closing a request is blocked while a Stripe plan is active (also enforced in the close action).
  let plan: ActiveSubscriptionStatus = { active: false, setToEnd: false, endsAt: null }
  if (user && openRequestStatus) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()
    if (prof?.stripe_customer_id) {
      try {
        plan = await getActiveSubscriptionStatus(prof.stripe_customer_id)
      } catch (e) {
        // The close action re-checks and refuses if billing status cannot be verified.
        console.error(
          '[request-website] subscription lookup failed',
          e instanceof Error ? e.message : e
        )
      }
    }
  }

  const inReview = openRequestStatus === 'in_review'

  return (
    <div>
      {openRequestStatus === 'submitted' ? (
        <>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Update your request</h1>
          <p className="text-gray-600 mb-8 max-w-2xl">
            Change anything below and save. We&apos;ll use the latest version when we review it.
          </p>
        </>
      ) : inReview ? (
        <>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your request is being reviewed</h1>
          <p className="text-gray-600 mb-8 max-w-2xl">
            We&apos;re working from the details you sent, so this form is locked for now. If
            something changed, email{' '}
            <a href="mailto:support@freeplug-in.dev" className="text-[#ba3d3d] hover:underline">
              support@freeplug-in.dev
            </a>{' '}
            and we&apos;ll update it for you.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Request a website</h1>
          <p className="text-gray-600 mb-8 max-w-2xl">
            Share your local business details. We evaluate every request in person, by email, or
            phone. After we review your Google Business presence and scope, we will follow up with
            next steps.
          </p>
        </>
      )}
      {openRequestStatus ? (
        <div className="mb-8 max-w-lg rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
          <p className="text-sm font-medium text-amber-950 mb-2">You have an open request</p>
          {plan.active ? (
            <>
              <p className="text-sm text-gray-700 mb-3">
                {plan.setToEnd
                  ? closeBlockedPlanEndingMessage(plan.endsAt)
                  : CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE}
              </p>
              {/* Lina, round 5b: the message says "choose Cancel options in your dashboard", so link there. */}
              <Link
                href="/dashboard/cancel"
                className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#ba3d3d] underline underline-offset-2 hover:text-[#9a3232]"
                data-testid="close-blocked-cancel-link"
              >
                {CANCEL_OPTIONS_LINK}
              </Link>
            </>
          ) : (
            <CloseOpenRequestButton status={openRequestStatus} />
          )}
        </div>
      ) : null}
      <RequestWebsiteForm
        focusMaintenance={focusMaintenance}
        defaultValues={defaultValues}
        locked={inReview}
      />
      <p className="mt-8 text-sm text-gray-500">
        <Link href="/dashboard" className="text-[#ba3d3d] hover:underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  )
}
