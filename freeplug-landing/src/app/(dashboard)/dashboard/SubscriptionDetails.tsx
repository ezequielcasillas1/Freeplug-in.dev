import Link from 'next/link'
import { CreditCard, Calendar, ArrowRight } from 'lucide-react'
import type { SubscriptionDetail } from './dashboard-actions'
import {
  PRIORITY_DASHBOARD_LINE,
  monthlyCents,
  qualifiesForPriority,
} from '@/lib/plans/priority'
import { formatBillingDate } from '@/lib/stripe/subscription-dates'
import { cumulativePerks } from '@/lib/plans/ladder'
import {
  CHANGE_PLAN_LINK,
  INCLUDED_EDIT_LINE,
  KEEP_PLAN_BUTTON,
  LEGACY_PLAN_LABEL,
  LEGACY_PLAN_NOTE,
  PENDING_CHANGE_LINE,
  PERK_LINES,
} from '@/lib/plans/ladder-copy'
import type { WebsiteAccess } from '@/lib/website-access'
import type { OutreachSubscriptionState } from './outreach-dashboard'
import { OutreachPlanCard } from './OutreachPlanCard'

type Props = {
  subscriptions: SubscriptionDetail[]
  /** Website access state; when offline the access alert's "Restart hosting" is the only plans link. */
  websiteAccess?: WebsiteAccess | null
  /**
   * Claimed outreach customer (see outreach-dashboard.ts): never "No active subscriptions / View
   * available plans". Before Live: the claim-steps link or the plan-waiting message. After Live:
   * the real plan, or Sable's 3:27 line when it can't be loaded. Null = organic (unchanged).
   */
  outreach?: OutreachSubscriptionState
}

/** Lina (Sep 25): no "View available plans" in the offline state ("Restart hosting" covers it). */
export function hideViewPlansLink(access: WebsiteAccess | null | undefined): boolean {
  return !!access && access.status === 'offline' && access.hasHostingHistory
}


function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-50', text: 'text-green-700' },
  trialing: { bg: 'bg-blue-50', text: 'text-blue-700' },
  past_due: { bg: 'bg-red-50', text: 'text-red-700' },
  canceled: { bg: 'bg-gray-100', text: 'text-gray-600' },
  unpaid: { bg: 'bg-amber-50', text: 'text-amber-700' },
  incomplete: { bg: 'bg-amber-50', text: 'text-amber-700' },
  incomplete_expired: { bg: 'bg-gray-100', text: 'text-gray-600' },
  paused: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

export function SubscriptionDetails({ subscriptions, websiteAccess = null, outreach = null }: Props) {
  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  )

  // Outreach: the plan list shows only after Live with a loaded plan; anything else is one line.
  const outreachBox = outreach
    ? outreach.box === 'plan' && activeSubscriptions.length === 0
      ? 'plan_unavailable'
      : outreach.box
    : null

  if (outreachBox !== null && outreachBox !== 'plan') return <OutreachPlanCard box={outreachBox} />

  if (activeSubscriptions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-gray-50 p-2">
            <CreditCard className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
              Active Subscriptions
            </h2>
            <p className={hideViewPlansLink(websiteAccess) ? 'text-gray-600' : 'text-gray-600 mb-4'}>
              No active subscriptions.
            </p>
            {hideViewPlansLink(websiteAccess) ? null : (
              <Link
                href="/dashboard/plans"
                className="inline-flex items-center gap-1 font-semibold text-[#ba3d3d] hover:underline text-sm"
              >
                View available plans
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
        Active Subscriptions
      </h2>
      <div className="space-y-4">
        {activeSubscriptions.map((sub) => {
          const colors = statusColors[sub.status] || statusColors.active

          return (
            <div
              key={sub.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-zinc-100 pb-4 last:border-0 last:pb-0"
            >
              {/* Below 640px: plan name, then badges, then the date on its own line (Lina, Sep 25). */}
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-lg bg-[#ba3d3d]/10 p-2">
                  <CreditCard className="h-5 w-5 text-[#ba3d3d]" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <h3 className="font-semibold text-gray-900">{sub.productName}</h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                      </span>
                      {sub.cancelAtPeriodEnd && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700">
                          Canceling
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {formatCents(sub.amount)}/{sub.interval}
                  </p>
                  {(sub.entitlements ? sub.entitlements.priorityRank >= 1 : qualifiesForPriority(monthlyCents(sub.amount, sub.interval))) ? (
                    <p className="text-sm text-gray-700 mt-1">{PRIORITY_DASHBOARD_LINE}</p>
                  ) : null}
                  {sub.entitlements?.step && !sub.entitlements.legacy ? (
                    <div className="mt-1 text-sm text-gray-700" data-testid="plan-step">
                      <p className="font-medium">{sub.entitlements.step.name}</p>
                      <ul className="list-disc pl-4 text-gray-600">
                        {cumulativePerks(sub.entitlements.step.id)
                          .filter((perk) => perk !== 'priorityQueue')
                          .map((perk) => (
                            <li key={perk}>{PERK_LINES[perk]}</li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                  {sub.entitlements?.legacy ? (
                    <div className="mt-1 text-sm text-gray-600" data-testid="legacy-plan">
                      <p>{LEGACY_PLAN_LABEL}</p>
                      <p>{LEGACY_PLAN_NOTE}</p>
                    </div>
                  ) : null}
                  {sub.includedEdit ? (
                    <p className="text-sm text-gray-700 mt-1" data-testid="included-edit">
                      {INCLUDED_EDIT_LINE(sub.includedEdit.used, sub.includedEdit.available)}
                    </p>
                  ) : null}
                  {/* Lina §3c: the pending change + a Keep link (the action lives on Plans), then "Change plan". */}
                  {sub.pendingChange ? (
                    <p className="text-sm text-amber-800 mt-2" data-testid="home-pending-change">
                      {PENDING_CHANGE_LINE(sub.pendingChange.stepName, sub.pendingChange.date)}{' '}
                      {sub.entitlements?.step && !sub.entitlements.legacy ? (
                        <Link href="/dashboard/plans" className="font-semibold text-[#ba3d3d] hover:underline whitespace-nowrap">
                          {KEEP_PLAN_BUTTON(sub.entitlements.step.name)}
                        </Link>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm">
                    <Link href="/dashboard/plans" className="font-semibold text-[#ba3d3d] hover:underline" data-testid="home-change-plan">
                      {CHANGE_PLAN_LINK}
                    </Link>
                  </p>
                </div>
              </div>
              <div className="pl-12 sm:pl-0 sm:shrink-0 sm:text-right text-sm">
                <div className="flex items-center gap-1 text-gray-500">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'}: {formatBillingDate(sub.currentPeriodEnd)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-zinc-100 flex gap-4">
        <Link
          href="/dashboard/plans"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#ba3d3d] hover:underline"
        >
          Manage plans
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/dashboard/cancel"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Cancel options
        </Link>
      </div>
    </div>
  )
}
