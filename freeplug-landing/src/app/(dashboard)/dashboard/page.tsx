import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/supabase/ensure-profile'
import type { EvaluationStatus, ProfileRow } from '@/types/supabase'
import { Button } from '@/components/ui/button'
import { openBillingPortal } from './billing-actions'
import { CloseOpenRequestButton } from './request-website/CloseOpenRequestButton'
import { EvaluationProgress } from './EvaluationProgress'
import { milestoneWebsiteValueReached } from '@/lib/dashboard/website-milestone'
import { getEnhancedDashboardData } from './dashboard-actions'
import { QuickStats } from './QuickStats'
import { SubscriptionDetails } from './SubscriptionDetails'
import { RecentActivity } from './RecentActivity'
import { DashboardAlerts } from './DashboardAlerts'
import { SupportCard } from './SupportCard'

type Props = {
  searchParams: Promise<{ submitted?: string; checkout?: string }>
}

function requestStatusLabel(status: string | undefined): string {
  if (status === 'submitted') return 'Submitted'
  if (status === 'in_review') return 'In review'
  if (status === 'closed') return 'Closed'
  return '—'
}

export default async function DashboardPage({ searchParams }: Props) {
  const q = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  await ensureProfile(user.id)

  const [profileResult, enhancedData] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    getEnhancedDashboardData(),
  ])

  const profile = profileResult.data

  const p = profile as Pick<
    ProfileRow,
    | 'evaluation_status'
    | 'evaluation_progress'
    | 'website_value_target_cents'
    | 'cumulative_website_value_paid_cents'
    | 'stripe_customer_id'
    | 'website_transfer_notes'
    | 'website_transfer_acknowledged_at'
  > | null

  const status = (p?.evaluation_status ?? 'none') as EvaluationStatus
  const progress = p?.evaluation_progress ?? 0
  const targetCents = p?.website_value_target_cents ?? null
  const paidCents = p?.cumulative_website_value_paid_cents ?? 0
  const milestoneReached = milestoneWebsiteValueReached(targetCents, paidCents)

  const { data: openRequest } = await supabase
    .from('website_requests')
    .select('id, status, business_name, updated_at')
    .eq('user_id', user.id)
    .in('status', ['submitted', 'in_review'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: latestRequest } = await supabase
    .from('website_requests')
    .select('id, status, business_name, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const intakeClosedInfo =
    !openRequest && latestRequest?.status === 'closed'
      ? { businessName: latestRequest.business_name?.trim() || 'Your request' }
      : null

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-6">Welcome back! Here is an overview of your account.</p>

      {q.submitted === '1' ? (
        <p className="mb-6 rounded-lg bg-green-50 border border-green-200 text-green-900 px-4 py-3 text-sm">
          Thanks — your request was submitted. We will follow up by email or phone.
        </p>
      ) : null}

      {q.checkout === 'success' ? (
        <p className="mb-6 rounded-lg bg-zinc-50 border border-zinc-200 text-gray-800 px-4 py-3 text-sm">
          Checkout completed. Payment totals may take a short time to appear here after the webhook
          runs.
        </p>
      ) : null}

      {/* Alerts Section */}
      {enhancedData && <DashboardAlerts alerts={enhancedData.alerts} />}

      {/* Quick Stats Row */}
      {enhancedData && <QuickStats stats={enhancedData.stats} />}

      <EvaluationProgress
        status={status}
        progress={progress}
        targetCents={targetCents}
        paidCents={paidCents}
        milestoneReached={milestoneReached}
        stripeCustomerId={p?.stripe_customer_id ?? null}
        intakeClosed={intakeClosedInfo}
        websiteTransferNotes={p?.website_transfer_notes ?? null}
        websiteTransferAcknowledgedAt={p?.website_transfer_acknowledged_at ?? null}
      />

      {/* Subscription Details */}
      {enhancedData && (
        <div className="mb-8">
          <SubscriptionDetails subscriptions={enhancedData.subscriptions} />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Your request
          </h2>
          {openRequest ? (
            <>
              <p className="text-gray-900 font-medium truncate" title={openRequest.business_name}>
                {openRequest.business_name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Status: {requestStatusLabel(openRequest.status)}
              </p>
              <Link
                href="/dashboard/request-website"
                className="mt-4 inline-flex font-semibold text-[#ba3d3d] hover:underline"
              >
                View or update →
              </Link>
              <CloseOpenRequestButton
                status={openRequest.status}
                className="mt-4 pt-4 border-t border-zinc-100"
              />
            </>
          ) : latestRequest?.status === 'closed' ? (
            <>
              <p className="text-gray-900 font-medium truncate" title={latestRequest.business_name}>
                {latestRequest.business_name}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Status: {requestStatusLabel('closed')}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                This request is closed. You can start a new request when you are ready.
              </p>
              <Link
                href="/dashboard/request-website"
                className="mt-4 inline-flex font-semibold text-[#ba3d3d] hover:underline"
              >
                New request →
              </Link>
            </>
          ) : (
            <>
              <p className="text-gray-700 mb-4">No website request yet.</p>
              <Link
                href="/dashboard/request-website"
                className="inline-flex font-semibold text-[#ba3d3d] hover:underline"
              >
                Start a request →
              </Link>
            </>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Next step
          </h2>
          <p className="text-gray-700 mb-4">
            {intakeClosedInfo
              ? 'Your last request is closed. Open a new request if you want us to review a new or updated project.'
              : status === 'none'
                ? 'Tell us about your business and link your Google Business Profile.'
                : openRequest
                  ? 'You can update your request details while it is still marked submitted.'
                  : 'Use the request form when you are ready for us to review your business.'}
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard/request-website"
              className="inline-flex font-semibold text-[#ba3d3d] hover:underline"
            >
              Request a website →
            </Link>
            <Link
              href="/dashboard/plans"
              className="inline-flex font-semibold text-[#ba3d3d] hover:underline"
            >
              View plans & hosting →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Account
          </h2>
          <p className="text-gray-900 mb-4">{user.email}</p>
          {p?.stripe_customer_id ? (
            <form action={openBillingPortal}>
              <Button type="submit" variant="secondary" size="sm">
                Manage billing
              </Button>
            </form>
          ) : (
            <p className="text-xs text-gray-500">
              After you complete a logged-in checkout, you can open the Stripe customer portal from
              here.
            </p>
          )}
        </div>
      </div>

      {/* Recent Activity and Support */}
      <div className="grid gap-6 md:grid-cols-2 mt-8">
        {enhancedData && <RecentActivity activities={enhancedData.recentActivity} />}
        <SupportCard />
      </div>
    </div>
  )
}
