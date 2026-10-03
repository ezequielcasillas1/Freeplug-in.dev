import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClaimStepLine } from '@/components/outreach/ClaimStepLine'
import { ClaimNeutralCard } from '@/components/outreach/ClaimNeutralCard'
import {
  currentPreviewSite,
  customerPreviewPhotos,
  getClaimedSiteForUser,
  getSiteDetails,
  latestPreviewSubmission,
  syncSetupSessionForUser,
} from '@/lib/outreach/server'
import { readPrefill, readServiceSources } from '@/lib/outreach/schemas'
import { formatMonthly, resolveOutreachPlan } from '@/lib/outreach/plan'
import {
  CLAIMING_FOR_LINE,
  STEP2_BODY,
  STEP2_HEADING,
  STEP3_BODY,
  STEP3_HEADING,
  STEP4_BODY,
  STEP4_HEADING,
  fill,
} from '@/lib/outreach/copy'
import { ClaimAddCardButton, ClaimDetailsStep, ClaimPlanStep, ClaimWaiting } from './ClaimSteps'
import { ClaimStartForm } from './ClaimStartForm'
import { claimStartToken, liveClaimRedirect, shouldAutoClaim } from './start/claim-redirect'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ setup?: string; session_id?: string; claim?: string }> }

const CARD = 'rounded-xl border border-zinc-200 bg-white p-6 shadow-sm'

function Shell({ step, businessName, children }: { step: 1 | 2 | 3 | 4; businessName: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <ClaimStepLine step={step} />
        <p className="text-sm text-gray-500">{fill(CLAIMING_FOR_LINE, { 'Business Name': businessName })}</p>
        {children}
      </div>
    </main>
  )
}

/**
 * Claim steps (Lina, screen 2): 1 Account (/signup?next=/claim), 2 Your details, 3 Hosting plan,
 * 4 Add card (saves the card only; an admin publishes and starts billing). Signed-in users skip step 1. The claim itself runs through the service-role RPC and
 * needs a confirmed email (Vera rule 6).
 */
/** The signed-in user's own address when it isn't confirmed yet, else null (round 7). */
function unconfirmedEmailOf(user: { email?: string | null; email_confirmed_at?: string | null }): string | null {
  const email = user.email?.trim()
  return email && !user.email_confirmed_at ? email : null
}

export default async function ClaimPage({ searchParams }: Props) {
  const q = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (!(await currentPreviewSite())) notFound()
    redirect('/signup?next=/claim')
  }

  // Jace's 3-case rule (round 6):
  //   1. Signed in with a saved claim: straight to the current step, whatever link this browser has.
  //   2. Signed in, no claim, no valid link: the neutral page (below), identical in every case.
  //   3. Signed out with no valid link: the 404 above, which names no business.
  // A valid link keeps the claim card.
  const site = await getClaimedSiteForUser(user.id)
  if (!site) {
    // Round 7: the amber confirm-email box for an unconfirmed account. The address is the
    // signed-in user's own, from the verified session (never a query string or link).
    const unconfirmedEmail = unconfirmedEmailOf(user)
    const preview = await currentPreviewSite()
    if (!preview) {
      // Nothing about the link reaches this render (not the link, the ?claim= value or the reason
      // the link failed), so the page and its status (200) are the same for every neutral case.
      return (
        <main className="min-h-screen bg-zinc-50">
          <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
            <ClaimNeutralCard unconfirmedEmail={unconfirmedEmail} />
          </div>
        </main>
      )
    }
    // The claim itself runs in /claim/start, which redirects back here on a fresh request
    // (Vera QA #1). Its outcome comes back as ?claim=… (email_unconfirmed shows the card with the
    // amber box on top, and never submits by itself).
    const stale = q.claim === 'stale'
    // The claim is a same-site POST to /claim/start (Vera r2 bug 9), sent by the card's form:
    // on its own when the page was opened from this site (e.g. right after sign-up), otherwise
    // after one tap on "Claim my website". It never submits by itself when it comes back with a
    // ?claim= outcome (a stale token, Sable 1:45 AM, or a failed claim), so it can't loop.
    const secFetchSite = (await headers()).get('sec-fetch-site')
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <ClaimStartForm
            auto={!q.claim && !unconfirmedEmail && shouldAutoClaim(secFetchSite)}
            stale={stale}
            businessName={preview.business_name}
            token={claimStartToken(user.id, preview.id)}
            unconfirmedEmail={unconfirmedEmail}
          />
        </div>
      </main>
    )
  }

  if (q.setup === 'success' && q.session_id) {
    // Same reason: save the card state, then render the waiting screen on a fresh request.
    await syncSetupSessionForUser(user.id, q.session_id)
    redirect('/claim')
  }

  // Once the site is live there's nothing left to claim: the dashboard shows it (Vera r3 NEW-3).
  const live = liveClaimRedirect(site)
  if (live) redirect(live)

  const details = await getSiteDetails(site.id)
  const step: 2 | 3 | 4 = !details?.customer_confirmed_at ? 2 : site.plan_hosting_cents == null ? 3 : 4

  if (step === 2) {
    const sent = await latestPreviewSubmission(site.id)
    return (
      <Shell step={2} businessName={site.business_name}>
        <section className={CARD}>
          <h1 className="text-xl font-semibold text-gray-900">{STEP2_HEADING}</h1>
          <p className="mt-1 mb-5 text-sm text-gray-600">{STEP2_BODY}</p>
          <ClaimDetailsStep
            prefill={readPrefill(site.prefill)}
            services={readServiceSources(site.services, site.service_sources)}
            initialFields={sent?.fields}
            initialServices={sent?.services}
            sentPhotos={await customerPreviewPhotos(user.id)}
          />
        </section>
      </Shell>
    )
  }

  if (step === 3) {
    return (
      <Shell step={3} businessName={site.business_name}>
        <section className="space-y-4">
          <div className={CARD}>
            <h1 className="text-xl font-semibold text-gray-900">{STEP3_HEADING}</h1>
            <p className="mt-1 text-sm text-gray-600">{STEP3_BODY}</p>
          </div>
          <ClaimPlanStep />
        </section>
      </Shell>
    )
  }

  const plan = resolveOutreachPlan(site.plan_hosting_cents, site.plan_addon_tier ?? 'none')
  return (
    <Shell step={4} businessName={site.business_name}>
      <section className={CARD}>
        {site.setup_completed_at ? (
          <ClaimWaiting />
        ) : (
          <>
            <h1 className="text-xl font-semibold text-gray-900">{STEP4_HEADING}</h1>
            <p className="mt-1 text-sm text-gray-600">{STEP4_BODY}</p>
            <dl className="my-5 space-y-1 text-sm text-gray-700">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">{site.business_name}</dt>
                <dd>{plan ? `${formatMonthly(plan.totalCents)}` : ''}</dd>
              </div>
              {plan?.addon ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{plan.addon.name}</dt>
                  <dd>+{formatMonthly(plan.addon.monthlyCents)}</dd>
                </div>
              ) : null}
            </dl>
            <ClaimAddCardButton />
          </>
        )}
      </section>
    </Shell>
  )
}
