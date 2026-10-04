import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ensureProfile } from '@/lib/supabase/ensure-profile'
import type { EvaluationStatus, ProfileRow } from '@/types/supabase'
import { Button } from '@/components/ui/button'
import { openBillingPortal } from './billing-actions'
import { ladderCopy } from '@/lib/plans/ladder-copy'
import { currentLocale } from '@/i18n/current-locale'
import { getEnhancedDashboardData } from './dashboard-actions'
import { QuickStats } from './QuickStats'
import { AccountCard } from './AccountCard'
import { SubscriptionDetails } from './SubscriptionDetails'
import { outreachDashboardState } from './outreach-dashboard'
import { RecentActivity } from './RecentActivity'
import { DashboardAlerts } from './DashboardAlerts'
import { DashboardAddonRefundNotes } from './DashboardAddonRefundNotes'
import { SupportCard } from './SupportCard'
import { syncStripeCustomerFromCheckoutSession } from '@/lib/stripe/sync-checkout-customer'
import { dashboardAccessAlert, getWebsiteAccessForCustomer, type WebsiteAccess } from '@/lib/website-access'
import { WebsiteAccessAlert } from './WebsiteAccessAlert'
import { DashboardBuyoutCard } from './BuyoutCard'
import { requestBuyoutQuote } from './buyout-actions'
import { YourWebsiteCard } from './YourWebsiteCard'
import { QuickActions } from './QuickActions'
import { getClaimedSiteForUser, getSiteDetails } from '@/lib/outreach/server'
import { organicTracker, outreachTracker } from '@/lib/outreach/tracker'
import { TRACKER_LIVE_WAITING } from '@/lib/outreach/copy'
import { ChangeRequestsCard } from './ChangeRequestsCard'
import {
  CUSTOMER_CHANGE_REQUEST_COLUMNS,
  CUSTOMER_CHANGE_REQUEST_LIMIT,
  type CustomerChangeRequest,
} from '@/lib/change-requests/customer'

type Props = {
  searchParams: Promise<{
    submitted?: string
    checkout?: string
    session_id?: string
    password_reset?: string
    hosting?: string
  }>
}

function requestStatusLabel(status: string | undefined): string {
  if (status === 'submitted') return 'Submitted'
  if (status === 'in_review') return 'In review'
  if (status === 'closed') return 'Closed'
  return '—'
}

export default async function DashboardPage({ searchParams }: Props) {
  const { RESUME_BUSY_MESSAGE, RESUME_FAILED_MESSAGE } = ladderCopy(await currentLocale())
  const q = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  await ensureProfile(user.id)

  if (q.checkout === 'success' && q.session_id) {
    // Webhook fallback: save the Stripe customer id from the verified Checkout Session.
    await syncStripeCustomerFromCheckoutSession(q.session_id, user.id)
  }

  // Claimed outreach site first: its customers never get a failed page from a Stripe error.
  const outreachSite = await getClaimedSiteForUser(user.id)
  const [profileResult, enhancedData] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    getEnhancedDashboardData({ tolerateStripeErrors: Boolean(outreachSite) }),
  ])

  const profile = profileResult.data

  const p = profile as Pick<
    ProfileRow,
    'evaluation_status' | 'stripe_customer_id'
  > | null

  const status = (p?.evaluation_status ?? 'none') as EvaluationStatus

  // Website access (hosting required): ending / offline message with one button. A failed Stripe
  // lookup shows nothing rather than a wrong status.
  let websiteAccess: WebsiteAccess | null = null
  if (p?.stripe_customer_id) {
    try {
      websiteAccess = await getWebsiteAccessForCustomer(p.stripe_customer_id)
    } catch (e) {
      console.error('[dashboard] website access lookup failed', e instanceof Error ? e.message : e)
    }
  }
  // Offline only; a plan set to end shows the one "Subscription ending" alert instead (next round).
  const accessAlert = dashboardAccessAlert(websiteAccess)

  const { data: openRequest } = await supabase
    .from('website_requests')
    .select('id, status, business_name, updated_at, is_buyout')
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

  // Help-chat change requests (own rows, RLS). A read error (e.g. before migration 20261004150000)
  // hides the card instead of showing a wrong empty list.
  const { data: changeRows, error: changeErr } = await supabase
    .from('change_requests')
    .select(CUSTOMER_CHANGE_REQUEST_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(CUSTOMER_CHANGE_REQUEST_LIMIT)
  if (changeErr) console.error('[dashboard] change requests lookup failed', changeErr.message)
  const changeRequests = changeErr ? null : ((changeRows ?? []) as CustomerChangeRequest[])

  // "Your website" card (Lina): outreach steps for claimed outreach sites, organic steps otherwise.
  const outreachDetails = outreachSite ? await getSiteDetails(outreachSite.id) : null
  const hasActivePlan = (enhancedData?.subscriptions ?? []).some((s) => s.status === 'active' || s.status === 'trialing')
  const outreachLive = outreachSite?.publish_status === 'live'
  const trackerSteps = outreachSite
    ? outreachTracker({
        claimed: true,
        detailsConfirmed: Boolean(outreachDetails?.customer_confirmed_at),
        hostingSetUp: Boolean(outreachSite.setup_completed_at),
        live: outreachLive,
      })
    : latestRequest
      ? organicTracker({
          hasRequest: true,
          building: latestRequest.status === 'in_review',
          hostingSetUp: hasActivePlan,
          live: websiteAccess?.status === 'active',
        })
      : null
  const outreachDash = outreachDashboardState(outreachSite, {
    steps: outreachSite ? trackerSteps : null,
    plans: {
      activePlanCount: (enhancedData?.subscriptions ?? []).filter((s) => s.status === 'active' || s.status === 'trialing').length,
      plansLoaded: enhancedData?.subscriptionsLoaded ?? false,
    },
    hasStripeCustomer: Boolean(p?.stripe_customer_id),
  })

  const intakeClosedInfo =
    !openRequest && latestRequest?.status === 'closed'
      ? { businessName: latestRequest.business_name?.trim() || 'Your request' }
      : null

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-6">Welcome back! Here is an overview of your account.</p>

      {q.hosting === 'resume_failed' ? (
        <p
          className="mb-6 rounded-lg bg-red-50 border border-red-200 text-red-900 px-4 py-3 text-sm"
          role="alert"
          data-testid="resume-failed"
        >
          {RESUME_FAILED_MESSAGE}
        </p>
      ) : null}
      {q.hosting === 'resume_busy' ? (
        <p
          className="mb-6 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 text-sm"
          role="status"
          data-testid="resume-busy"
        >
          {RESUME_BUSY_MESSAGE}
        </p>
      ) : null}

      {p?.stripe_customer_id ? <DashboardAddonRefundNotes customerId={p.stripe_customer_id} /> : null}

      {q.password_reset === '1' ? (
        <p
          className="mb-6 rounded-lg bg-green-50 border border-green-200 text-green-900 px-4 py-3 text-sm"
          role="status"
        >
          Your password has been updated. You&apos;re signed in.
        </p>
      ) : null}

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

      {/* Website offline ("Restart hosting"): first card, per Lina. Ending = the Subscription ending alert. */}
      {accessAlert ? <WebsiteAccessAlert alert={accessAlert} /> : null}

      {trackerSteps ? (
        <YourWebsiteCard
          steps={trackerSteps}
          liveUrl={outreachSite ? (outreachLive ? outreachSite.live_url : null) : null}
          showPreview={Boolean(outreachSite && !outreachLive && (outreachSite.screenshot_desktop_path || outreachSite.screenshot_mobile_path))}
          liveNote={outreachSite && !outreachLive ? TRACKER_LIVE_WAITING : null}
        />
      ) : null}

      {/* Alerts Section */}
      {enhancedData && <DashboardAlerts alerts={enhancedData.alerts} />}

      {/* Quick Stats Row */}
      {enhancedData && (
        <QuickStats stats={enhancedData.stats} website={outreachDash.websiteCard} activePlansDash={outreachDash.activePlansDash} />
      )}

      {/* Subscription Details */}
      {enhancedData && (
        <div className="mb-8">
          <SubscriptionDetails
            subscriptions={enhancedData.subscriptions}
            websiteAccess={websiteAccess}
            outreach={outreachDash.subscriptionState}
          />
        </div>
      )}

      <QuickActions canManageBilling={Boolean(p?.stripe_customer_id)} showManageBilling={outreachDash.showManageBillingAction} />

      {/* Website buyout (replaces the old website value section): active, ending and offline. */}
      <DashboardBuyoutCard
        access={websiteAccess}
        alreadyRequested={openRequest?.is_buyout === true}
        onRequest={requestBuyoutQuote}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {outreachDash.showRequestCard ? (
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
              </>
            ) : (
              <p className="text-gray-700">No website request yet.</p>
            )}
            <p className="text-sm text-gray-700 mt-4 pt-4 border-t border-zinc-100">
              <span className="font-medium text-gray-900">Next step: </span>
              {intakeClosedInfo
                ? 'Your last request is closed. Open a new request if you want us to review a new or updated project.'
                : status === 'none'
                  ? 'Tell us about your business and link your Google Business Profile.'
                  : openRequest
                    ? 'You can update your request details while it is still marked submitted.'
                    : 'Use the request form when you are ready for us to review your business.'}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/dashboard/request-website"
                className="inline-flex font-semibold text-[#ba3d3d] hover:underline"
              >
                {openRequest
                  ? 'View or update →'
                  : latestRequest?.status === 'closed'
                    ? 'New request →'
                    : 'Start a request →'}
              </Link>
              <Link
                href="/dashboard/plans"
                className="inline-flex font-semibold text-[#ba3d3d] hover:underline"
              >
                View plans & hosting →
              </Link>
            </div>
          </div>
        ) : null}

        <AccountCard
          email={user.email}
          line={outreachDash.accountLine}
          manageBilling={
            <form action={openBillingPortal}>
              <Button type="submit" variant="secondary" size="sm">
                Manage billing
              </Button>
            </form>
          }
        />
      </div>

      {changeRequests ? (
        <div className="mt-8">
          <ChangeRequestsCard requests={changeRequests} />
        </div>
      ) : null}

      {/* Recent Activity and Support */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mt-8">
        {enhancedData && (
          <RecentActivity
            activities={enhancedData.recentActivity}
            loadFailed={!enhancedData.recentActivityLoaded}
          />
        )}
        <SupportCard />
      </div>
    </div>
  )
}
