import { AdminCumulativePaidCell } from './AdminCumulativePaidCell'
import { AdminQuickEmail } from './AdminQuickEmail'
import Link from 'next/link'
import { adminPlanAmount, adminPlanBadge, type AdminPlanBadge } from '@/lib/plans/admin-badge'
import { entitlementsFor } from '@/lib/plans/ladder'
import { adminMarkUnsoldPurchaseReviewed } from './actions'
import type { WebsiteAccessStatus } from '@/lib/website-access'

export type CustomerRowView = {
  id: string
  email: string | null
  displayName: string | null
  evaluation_status: string
  evaluation_progress: number
  cumulative_website_value_paid_cents: number
  stripe_customer_id: string | null
  /** Monthly total of active plans (hosting + add-on), null when unknown or no Stripe customer. */
  planMonthlyCents: number | null
  /** The tipping system: monthly tip in cents, shown as its own part ("+ $5 tip"). */
  planTipCents?: number | null
  /** Hosting-ladder step badge (replaces the Priority-only badge); null when unknown. */
  planBadge?: AdminPlanBadge | null
  /**
   * Checkout completed for a step that was no longer sellable (plan_unsold_purchases, not reviewed
   * yet). Honored; shown as a badge until marked reviewed.
   */
  unsoldPurchase?: { id: string; stepName: string; createdAt: string } | null
  /** Website access badge (null = never had hosting, or Stripe lookup failed). */
  websiteAccess: { status: WebsiteAccessStatus; label: string } | null
  updated_at: string
}

/** Admin filter on the customers table (?access=offline|ending). */
export type AccessFilter = 'all' | 'offline' | 'ending'

export function parseAccessFilter(value: string | undefined): AccessFilter {
  return value === 'offline' || value === 'ending' ? value : 'all'
}

export function filterCustomersByAccess(rows: CustomerRowView[], filter: AccessFilter): CustomerRowView[] {
  if (filter === 'all') return rows
  return rows.filter((r) => r.websiteAccess?.status === filter)
}

const ACCESS_FILTERS: { id: AccessFilter; label: string; href: string }[] = [
  { id: 'all', label: 'All customers', href: '/admin/customers' },
  { id: 'offline', label: 'Website offline (hosting canceled)', href: '/admin/customers?access=offline' },
  { id: 'ending', label: 'Canceled, still online', href: '/admin/customers?access=ending' },
]

/** Access badge tone: active green, ending amber, offline grey (no red). */
export const ACCESS_BADGE_TONE: Record<WebsiteAccessStatus, string> = {
  active: 'bg-green-50 text-green-800 border-green-200',
  // Same amber as the dashboard "Canceling" badge (Lina, Sep 25).
  ending: 'bg-amber-50 text-amber-700 border-amber-200',
  offline: 'bg-zinc-100 text-zinc-700 border-zinc-200',
}

/** Wraps between words, never mid-word. */
export function WebsiteAccessBadge({ access }: { access: CustomerRowView['websiteAccess'] }) {
  if (!access) return <span className="text-zinc-400">—</span>
  const tone = ACCESS_BADGE_TONE[access.status]
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold leading-snug whitespace-normal break-normal ${tone}`}
      data-access={access.status}
    >
      {access.label}
    </span>
  )
}

export function AdminCustomersTable({
  rows,
  mailConfigured,
  allowAdjustCumulativePaid = false,
  accessFilter = 'all',
  totalCount,
}: {
  rows: CustomerRowView[]
  accessFilter?: AccessFilter
  /** Rows before filtering (for the filter summary). */
  totalCount?: number
  mailConfigured: boolean
  /** When true and env `ADMIN_ALLOW_ADJUST_CUMULATIVE_PAID=true`, show QA override for paid cents. */
  allowAdjustCumulativePaid?: boolean
}) {
  const filterBar = (
    <nav className="mb-3 flex flex-wrap gap-2 text-sm" aria-label="Website access filter">
      {ACCESS_FILTERS.map((f) => (
        <Link
          key={f.id}
          href={f.href}
          aria-current={f.id === accessFilter ? 'page' : undefined}
          className={`rounded-full border px-3 py-1 ${
            f.id === accessFilter
              ? 'border-zinc-800 bg-zinc-800 text-white'
              : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          {f.label}
        </Link>
      ))}
      {accessFilter !== 'all' ? (
        <span className="self-center text-xs text-zinc-500">
          {rows.length} of {totalCount ?? rows.length}
        </span>
      ) : null}
    </nav>
  )

  if (rows.length === 0) {
    return (
      <>
        {filterBar}
        <p className="text-zinc-600 text-sm">No profile rows.</p>
      </>
    )
  }

  return (
    <>
    {filterBar}
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
          <tr>
            <th className="p-3 font-medium">Account email</th>
            <th className="p-3 font-medium">Name</th>
            <th className="p-3 font-medium">Evaluation</th>
            <th className="p-3 font-medium">Progress</th>
            <th className="p-3 font-medium">
              Paid (cumulative)
              {allowAdjustCumulativePaid ? (
                <span className="block font-normal text-amber-800 text-[10px]">QA override on</span>
              ) : null}
            </th>
            <th className="p-3 font-medium">Stripe customer</th>
            <th className="p-3 font-medium">Website</th>
            <th className="p-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100 align-top">
              <td className="p-3">
                <AdminQuickEmail to={r.email} mailConfigured={mailConfigured} />
              </td>
              <td className="p-3 text-zinc-800">{r.displayName ?? '—'}</td>
              <td className="p-3 font-mono text-xs">{r.evaluation_status}</td>
              <td className="p-3">{r.evaluation_progress}%</td>
              <td className="p-3 align-top">
                {allowAdjustCumulativePaid ? (
                  <AdminCumulativePaidCell
                    key={`cp-${r.id}-${r.cumulative_website_value_paid_cents}`}
                    profileId={r.id}
                    paidCents={r.cumulative_website_value_paid_cents}
                  />
                ) : (
                  <span>${(r.cumulative_website_value_paid_cents / 100).toFixed(2)}</span>
                )}
              </td>
              <td className="p-3 font-mono text-xs break-all max-w-[120px]">
                {r.stripe_customer_id ? (
                  <span title={r.stripe_customer_id}>
                    {r.stripe_customer_id.slice(0, 14)}…
                  </span>
                ) : (
                  '—'
                )}
                {r.planMonthlyCents ? (
                  <span className="mt-1 flex flex-wrap items-center gap-1 font-sans" data-testid="admin-plan-amount">
                    <AdminStepBadge
                      badge={
                        r.planBadge !== undefined
                          ? r.planBadge
                          : adminPlanBadge({
                              ...entitlementsFor({ legacy: { hostingCents: r.planMonthlyCents, addonTier: null } }),
                              legacy: false,
                            })
                      }
                    />
                    <span className="whitespace-nowrap">{adminPlanAmount(r.planMonthlyCents, r.planTipCents ?? 0)}</span>
                  </span>
                ) : null}
                <AdminUnsoldPurchaseBadge flag={r.unsoldPurchase ?? null} />
              </td>
              <td className="p-3 min-w-[110px] max-w-[160px]">
                <WebsiteAccessBadge access={r.websiteAccess} />
              </td>
              <td className="p-3 text-zinc-600 whitespace-nowrap text-xs">
                {new Date(r.updated_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}

/** Step badge: priority steps (rank >= 1) in red, Starter grey; "(legacy)" for grandfathered plans. */
export function AdminStepBadge({ badge }: { badge: AdminPlanBadge | null }) {
  if (!badge) return null
  return (
    <span
      data-plan-step={badge.stepId}
      className={
        badge.priority
          ? 'rounded bg-[#ba3d3d]/10 px-1 text-[10px] font-semibold text-[#ba3d3d]'
          : 'rounded bg-zinc-100 px-1 text-[10px] font-semibold text-zinc-600'
      }
    >
      {badge.label}
    </span>
  )
}

/**
 * "Bought a step that wasn't sold" (Aria, Oct 3 12:56): the checkout completed after the step's
 * sellable flag turned off. The plan is honored; this badge stays until someone marks it reviewed.
 */
export function AdminUnsoldPurchaseBadge({ flag }: { flag: CustomerRowView['unsoldPurchase'] }) {
  if (!flag) return null
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1 font-sans" data-testid="unsold-purchase-badge">
      <span
        className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-900"
        title={`Checkout completed ${new Date(flag.createdAt).toLocaleString()} for a step that was not for sale. Honored.`}
      >
        Bought {flag.stepName} (not for sale)
      </span>
      <form action={adminMarkUnsoldPurchaseReviewed}>
        <input type="hidden" name="id" value={flag.id} />
        <button type="submit" className="text-[10px] text-zinc-600 underline">
          Mark reviewed
        </button>
      </form>
    </span>
  )
}
