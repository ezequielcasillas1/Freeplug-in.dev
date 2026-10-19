import Link from 'next/link'
import type { LadderCopy } from '@/lib/plans/ladder-copy'
import { useLadderCopy } from '@/lib/plans/use-ladder-copy'
import { Button } from '@/components/ui/button'
import { cancelHostingAtPeriodEnd, resumePlan } from '../billing-actions'
import { ResumePlanSubmit } from '../ResumePlanSubmit'
import type { CancelPageData } from './actions'
import type { OutreachPlanBox } from '../outreach-dashboard'
import { OutreachPlanCard } from '../OutreachPlanCard'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale, type AppLocale } from '@/i18n/config'
import { formatUsdIn } from '@/i18n/format'
import { requestBuyoutQuote } from '../buyout-actions'
import { BuyoutCard } from '../BuyoutCard'
import type { BuyoutRequestResult } from '@/lib/buyout/buyout'
import { SUPPORT_EMAIL } from '@/lib/site'
import { formatBillingDate } from '@/lib/stripe/subscription-dates'
import { RESTART_HOSTING_HREF, accessTemplate, fillAccessTemplate, splitAccessTemplate } from '@/lib/website-access'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Globe,
  Wrench,
  Shield,
  RefreshCw,
} from 'lucide-react'


/**
 * "$65.00/month", or with a tip Sable's final TIP_TOTAL_LINE: "$65.00 + $6.00 tip = $71.00/month"
 * (Vera bug 4: the cancel page showed the plan price only).
 */
function priceLine(sub: { amount: number; tipCents?: number; addonCents?: number; interval: string }, copy: LadderCopy, locale: AppLocale = copy.LOCALE, perYear?: (amount: string) => string): string {
  const { ADDON_TOTAL_LINE, TIP_TOTAL_LINE } = copy
  const formatCents = (cents: number) => formatUsdIn(locale, cents, 2)
  const tip = sub.tipCents ?? 0
  const addons = sub.addonCents ?? 0
  if (addons > 0 && sub.interval === 'month') {
    return ADDON_TOTAL_LINE(formatCents(sub.amount), formatCents(addons), tip > 0 ? formatCents(tip) : null, formatCents(sub.amount + addons + tip))
  }
  if (tip > 0 && sub.interval === 'month') return TIP_TOTAL_LINE(formatCents(sub.amount), formatCents(tip), formatCents(sub.amount + tip))
  return sub.interval === 'month' ? copy.AMOUNT_PER_MONTH(formatCents(sub.amount))
    : sub.interval === 'year' && perYear && locale !== 'en' ? perYear(formatCents(sub.amount))
    : `${formatCents(sub.amount)}/${sub.interval}`
}

/** Cancel page body (split from page.tsx so it can be rendered with sample data for QA shots). */
export function CancelPlanView({
  data,
  buyoutRequested = false,
  onBuyoutRequest = requestBuyoutQuote,
  outreachBox = null,
  cancelError = false,
}: {
  data: CancelPageData
  /** ?cancel_error=1: the in-app cancel failed (CANCEL_FAILED_MESSAGE, with the support contact). */
  cancelError?: boolean
  /** The customer already has an open buyout request (card shows the thank-you line). */
  buyoutRequested?: boolean
  /** Injectable for the preview harness; defaults to the real server action. */
  onBuyoutRequest?: () => Promise<BuyoutRequestResult>
  /**
   * Claimed outreach customer (round 12): the dashboard's plan states. 'plan' = the existing cancel
   * flow; any other state replaces every plan section with the one outreach line (never "No Active
   * Subscriptions", "View available plans" or "Start with a website request"). Null = regular.
   */
  outreachBox?: OutreachPlanBox | null
}) {
  const copy = useLadderCopy()
  const { CANCEL_FAILED_MESSAGE, CANCEL_IN_APP_LINE, CANCEL_PLAN_BUTTON, CANCEL_WITH_PENDING_NOTE, addonsPendingEndLine } = copy
  const t = useTranslations()
  const tc = useTranslations('cancel')
  const locale = toAppLocale(useLocale())
  const dateFallback = t('common.dateFallback')
  const billingDate = (d: Date | null | undefined) => formatBillingDate(d, dateFallback, locale)
  if (outreachBox && outreachBox !== 'plan') {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{tc('managePlan')}</h1>
        <p className="text-gray-600 mb-8">{tc('reviewCurrentServicesUnderstandGet')}</p>
        {/* Same card as the dashboard. Before Live, Sable's 4:03 line under it; no cancel button,
            no solid red button in any of these states (the cancel flow needs a real plan). */}
        <section className="mb-10" data-testid="cancel-outreach-plan">
          <OutreachPlanCard box={outreachBox}>
            {outreachBox !== 'plan_unavailable' ? <CancelBeforeLiveHelp /> : null}
          </OutreachPlanCard>
        </section>
        <CancelHelpLine />
      </div>
    )
  }

  const hasActiveSubscriptions = data.subscriptions.length > 0
  const pendingChange = data.subscriptions.find((s) => s.pendingChange)?.pendingChange ?? null
  const endingAddons = data.subscriptions.find((s) => s.endingAddons)?.endingAddons ?? null
  const hasCanceledSubscriptions = data.canceledSubscriptions.length > 0
  // Canceled but still running: resume the existing plan instead of buying a second one.
  const hasEndingSubscription = data.canceledSubscriptions.some(
    (s) => s.cancelAtPeriodEnd && s.status !== 'canceled'
  )
  // Resume box date: when the canceled-but-running plan ends (same date helper as the warning).
  const endingAccessEndsAt = data.canceledSubscriptions.reduce<Date | null>(
    (latest, s) =>
      s.cancelAtPeriodEnd && s.status !== 'canceled' && s.currentPeriodEnd &&
      (!latest || s.currentPeriodEnd > latest)
        ? s.currentPeriodEnd
        : latest,
    null
  )
  // Cancel warning date: when the current paid period ends (latest active plan).
  const accessEndsAt = data.subscriptions.reduce<Date | null>(
    (latest, s) =>
      s.currentPeriodEnd && (!latest || s.currentPeriodEnd > latest) ? s.currentPeriodEnd : latest,
    null
  )
  const cancelWarning = splitAccessTemplate(accessTemplate('cancel.accessWarning', locale), accessEndsAt, locale)
  // "Changed your mind later?" only while the plan is active and not canceled (Sable, Sep 25 3:30 PM).
  const showComeBackBox = hasActiveSubscriptions && !hasEndingSubscription

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{tc('managePlan')}</h1>
      <p className="text-gray-600 mb-8">{tc('reviewCurrentServicesUnderstandGet')}</p>

      {/* Active Subscriptions */}
      {hasActiveSubscriptions && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-green-600" size={20} />
            {tc('activeServices')}
          </h2>
          <div className="space-y-4">
            {data.subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{sub.planName ?? sub.productName}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {priceLine(sub, copy, copy.LOCALE, (amount) => t('common.amountPerYear', { amount }))}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    {tc('active')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  {tc('nextBillingDate', { date: billingDate(sub.currentPeriodEnd) })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Canceled/Paused Subscriptions */}
      {hasCanceledSubscriptions && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="text-amber-600" size={20} />
            {tc('canceledScheduledCancel')}
          </h2>
          <div className="space-y-4">
            {data.canceledSubscriptions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-amber-200 bg-amber-50/50 p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{sub.planName ?? sub.productName}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {priceLine(sub, copy, copy.LOCALE, (amount) => t('common.amountPerYear', { amount }))}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    {sub.status === 'canceled' ? tc('canceled') : tc('canceling')}
                  </span>
                </div>
                {sub.cancelAtPeriodEnd && sub.status !== 'canceled' && (
                  <p className="text-sm text-amber-700 mt-3">
                    {tc('accessUntil', { date: billingDate(sub.currentPeriodEnd) })}
                  </p>
                )}
                {sub.canceledAt && (
                  <p className="text-sm text-gray-500 mt-3">
                    {tc('canceledOn', { date: billingDate(sub.canceledAt) })}
                  </p>
                )}
              </div>
            ))}

            {/* Resume CTA (hidden when a live plan is running and nothing is set to end) */}
            {(hasEndingSubscription || !hasActiveSubscriptions) && (
              <div id="resume-plan" className="rounded-xl border border-green-200 bg-green-50 p-5 scroll-mt-24">
                <div className="flex items-start gap-3">
                  <RefreshCw className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <h3 className="font-semibold text-green-900">
                      {hasEndingSubscription ? tc('resumeHeading') : tc('offlineHeading')}
                    </h3>
                    <p className="text-sm text-green-800 mt-1">
                      {hasEndingSubscription
                        ? fillAccessTemplate(accessTemplate('cancel.resumeUntilText', locale), endingAccessEndsAt, locale)
                        : tc('offlineSavedText')}
                    </p>
                    {hasEndingSubscription ? (
                      <form action={resumePlan}>
                        <ResumePlanSubmit className="mt-3 inline-flex font-semibold text-green-700 hover:text-green-800 hover:underline disabled:opacity-60 disabled:cursor-wait">
                          {t('dashboard.access.resumePlanLabel')} →
                        </ResumePlanSubmit>
                      </form>
                    ) : (
                      <Link
                        href={RESTART_HOSTING_HREF}
                        className="mt-3 inline-flex font-semibold text-green-700 hover:text-green-800 hover:underline"
                      >
                        {t('dashboard.access.restartHostingLabel')} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Website buyout when no plan is active (ending or offline): same card, own section. */}
      {!hasActiveSubscriptions && hasCanceledSubscriptions && (
        <section className="mb-10">
          <BuyoutCard
            variant="cancel"
            alreadyRequested={buyoutRequested}
            onRequest={onBuyoutRequest}
          />
        </section>
      )}

      {/* No Subscriptions State */}
      {!hasActiveSubscriptions && !hasCanceledSubscriptions && (
        <section className="mb-10">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center">
            <CreditCard className="mx-auto text-gray-400 mb-3" size={32} />
            <h3 className="font-semibold text-gray-900 mb-1">{tc('noActiveSubscriptions')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {data.hasStripeCustomer
                ? tc('dontHaveAnyActiveHosting')
                : tc('startWebsiteRequestThenChoose')}
            </p>
            <Link
              href="/dashboard/plans"
              className="inline-flex font-semibold text-[#ba3d3d] hover:underline"
            >
              {tc('viewAvailablePlans')}
            </Link>
          </div>
        </section>
      )}

      {/* Benefits Section - Why Keep Your Plan */}
      {hasActiveSubscriptions && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {tc('planIncludes')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <Globe className="text-[#ba3d3d] mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-medium text-gray-900">{tc('websiteHosting')}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {tc('keepsWebsiteOnlineOwnWeb')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <Shield className="text-[#ba3d3d] mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-medium text-gray-900">{tc('secureConnectionSsl')}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {tc('websiteLoadsOverSecureHttps')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <Wrench className="text-[#ba3d3d] mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <h3 className="font-medium text-gray-900">{tc('questionsAboutSite')}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {tc('askUsFromDashboardTeam')}
                  </p>
                </div>
              </div>
            </div>

            {/* Website buyout (replaces the old ownership card, same spot). */}
            <BuyoutCard
              variant="cancel"
              alreadyRequested={buyoutRequested}
              onRequest={onBuyoutRequest}
            />
          </div>
        </section>
      )}

      {/* Warning Section */}
      {hasActiveSubscriptions && (
        <section className="mb-10">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-amber-900">{tc('happensCancel')}</h3>
                <ul className="text-sm text-amber-800 mt-2 space-y-1.5 list-disc list-inside">
                  <li>{tc('websiteGoesOfflineEndPaid')}</li>
                  <li>{tc('searchEnginesMayDropWebsite')}</li>
                  <li>{tc('whileItsOfflineCustomersCant')}</li>
                  <li>{tc('websiteSavedBringBackSigning')}</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Cancel Action */}
      {hasActiveSubscriptions && data.hasStripeCustomer && (
        <section className="mb-10">
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
            <div className="flex items-start gap-3">
              <XCircle className="text-red-600 mt-0.5 flex-shrink-0" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">{tc('cancelSubscription')}</h3>
                {/* Vera N1: the in-app button at the bottom of this box is the only cancel (no portal). */}
                <p className="text-sm text-red-800 mt-1 mb-4" data-testid="cancel-in-app-line">
                  {CANCEL_IN_APP_LINE}
                </p>
                {/* Website access warning (Sable, swappable constant), directly above the button. */}
                <div
                  className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4"
                  role="note"
                  data-testid="cancel-access-warning"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      {cancelWarning.before}
                      <strong>{cancelWarning.date}</strong>
                      {cancelWarning.after}
                    </p>
                  </div>
                </div>
                {pendingChange ? (
                  // A downgrade is planned: canceling also cancels the switch (the schedule is released
                  // first, inside the change-plan lock).
                  <p className="text-sm text-red-800 mb-3" data-testid="cancel-pending-note">
                    {CANCEL_WITH_PENDING_NOTE(pendingChange.stepName, billingDate(pendingChange.effectiveAt))}
                  </p>
                ) : null}
                {endingAddons ? (
                  // Vera M-1 (Aria, Oct 4 9:28): add-ons the customer turned off, with their end date.
                  <p className="text-sm text-gray-700 mb-3" data-testid="cancel-ending-addons">
                    {addonsPendingEndLine(endingAddons.names, formatBillingDate(endingAddons.effectiveAt))}
                  </p>
                ) : null}
                {cancelError ? (
                  <p className="text-sm text-red-800 mb-3" role="alert" data-testid="cancel-error">
                    {CANCEL_FAILED_MESSAGE}
                  </p>
                ) : null}
                {/* The only cancel (Aria, Oct 3 4:05 PM): in the app, under the change-plan lock. The
                    billing portal's cancel is off. */}
                <form action={cancelHostingAtPeriodEnd}>
                  <Button type="submit" variant="destructive" size="sm">
                    {CANCEL_PLAN_BUTTON}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Come-back box: only while the plan is active and not canceled. Hidden when ending
          ("Ready to resume?" covers it) and offline ("Bring your website back" covers it). */}
      {showComeBackBox && (
        <section className="mb-6">
          <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6">
            <h3 className="font-semibold text-gray-900 mb-2">{tc('changedMindLater')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {tc('cancelComeBackSignUp')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/plans"
                className="inline-flex rounded-lg bg-[#ba3d3d] text-white px-4 py-2 text-sm font-semibold hover:opacity-95"
              >
                {tc('viewPlans')}
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex rounded-lg border border-zinc-300 bg-white text-gray-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-50"
              >
                {tc('backDashboard')}
              </Link>
            </div>
          </div>
        </section>
      )}

      <CancelHelpLine />
    </div>
  )
}

/** Sable 4:03 AM: grey, the email a mailto link with a 44px tap target (padding, no layout shift). */
function CancelBeforeLiveHelp() {
  const t = useTranslations('claim')
  const [before, after = ''] = t('beforeLiveHelp', { supportEmail: SUPPORT_EMAIL }).split(SUPPORT_EMAIL)
  return (
    <p className="mt-2 text-sm text-gray-600" data-testid="cancel-before-live-help">
      {before}
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="-my-3 inline-block py-3 font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
        data-testid="cancel-support-mailto"
      >
        {SUPPORT_EMAIL}
      </a>
      {after}
    </p>
  )
}

/* Help Section */
function CancelHelpLine() {
  const t = useTranslations('cancel')
  return (
    <section>
      <p className="text-sm text-gray-500 text-center">
        {t.rich('haveQuestionsBeforeMakingDecision', {
          a: (chunks) => (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#ba3d3d] hover:underline font-medium">
              {chunks}
            </a>
          ),
        })}
      </p>
    </section>
  )
}
