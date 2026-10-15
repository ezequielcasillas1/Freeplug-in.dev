import { getAuthSummariesByUserIds } from '@/lib/admin/auth-users'
import { isMailConfigured } from '@/lib/admin/mail'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserEntitlements } from '@/lib/plans/user-entitlements'
import { adminPlanBadge, type AdminPlanBadge } from '@/lib/plans/admin-badge'
import {
  adminAccessLabel,
  getWebsiteAccessForCustomer,
  type WebsiteAccessStatus,
} from '@/lib/website-access'
import { AdminConfigError } from '../AdminConfigError'
import {
  AdminCustomersTable,
  filterCustomersByAccess,
  parseAccessFilter,
  type CustomerRowView,
} from '../AdminCustomersTable'
import { AdminMailBanner } from '../AdminMailBanner'
import { adminExpireUnsellableCheckoutsForm } from '../actions'
import { resolvePlanStep } from '@/lib/plans/ladder'

type Props = {
  searchParams: Promise<{ access?: string; checkouts_expired?: string; checkouts_closed?: string; checkouts_checked?: string; checkouts_error?: string }>
}

export default async function AdminCustomersPage({ searchParams }: Props) {
  const sp = await searchParams
  const accessFilter = parseAccessFilter(sp.access)
  const mailOn = isMailConfigured()

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    const hint =
      process.env.NODE_ENV === 'development'
        ? (e instanceof Error ? e.message : String(e))
        : null
    return <AdminConfigError hint={hint} />
  }

  const { data: profileRows, error: profErr } = await admin
    .from('profiles')
    .select(
      'id, evaluation_status, evaluation_progress, cumulative_website_value_paid_cents, stripe_customer_id, updated_at'
    )
    .order('updated_at', { ascending: false })

  if (profErr) {
    return <p className="text-red-700 text-sm">{profErr.message}</p>
  }

  const profiles = profileRows ?? []
  const authForProfiles = await getAuthSummariesByUserIds(
    admin,
    profiles.map((p) => p.id)
  )

  // Checkouts completed for a step that was no longer sellable (honored; badge until reviewed).
  const unsold = new Map<string, { id: string; stepName: string; createdAt: string }>()
  {
    const { data: flags, error: flagErr } = await admin
      .from('plan_unsold_purchases')
      .select('id, user_id, stripe_customer_id, plan_step, created_at')
      .is('reviewed_at', null)
      .order('created_at', { ascending: false })
    if (flagErr) console.error('[admin/customers] unsold purchases', flagErr.message)
    const byCustomer = new Map(profiles.filter((p) => p.stripe_customer_id).map((p) => [p.stripe_customer_id as string, p.id as string]))
    for (const f of flags ?? []) {
      const owner = (f.user_id as string | null) ?? byCustomer.get(f.stripe_customer_id as string) ?? null
      if (!owner || unsold.has(owner)) continue
      unsold.set(owner, { id: f.id as string, stepName: resolvePlanStep(f.plan_step)?.name ?? String(f.plan_step), createdAt: f.created_at as string })
    }
  }

  const allowAdjustCumulativePaid = process.env.ADMIN_ALLOW_ADJUST_CUMULATIVE_PAID === 'true'

  // Plan step + monthly total from Stripe (step badge). A failed lookup just shows no amount.
  const planTotals = new Map<string, number | null>()
  const planTips = new Map<string, number>()
  const planBadges = new Map<string, AdminPlanBadge | null>()
  // Website access (hosting required) from Stripe, for the badge column and the offline filter.
  // Taking a site offline or restoring it stays manual.
  const access = new Map<string, { status: WebsiteAccessStatus; label: string } | null>()
  await Promise.all(
    profiles
      .filter((p) => p.stripe_customer_id)
      .map(async (p) => {
        try {
          const { entitlements: ent } = await getUserEntitlements(admin, p.id as string, p.stripe_customer_id as string)
          planTotals.set(p.id, ent.monthlyCents > 0 ? ent.monthlyCents : null)
          planTips.set(p.id, ent.tipCents ?? 0)
          planBadges.set(p.id, adminPlanBadge(ent))
        } catch (e) {
          console.error('[admin/customers] plan lookup failed', e instanceof Error ? e.message : e)
          planTotals.set(p.id, null)
          planBadges.set(p.id, null)
        }
        try {
          const a = await getWebsiteAccessForCustomer(p.stripe_customer_id)
          access.set(p.id, a.hasHostingHistory ? { status: a.status, label: adminAccessLabel(a) } : null)
        } catch (e) {
          console.error('[admin/customers] website access lookup failed', e instanceof Error ? e.message : e)
          access.set(p.id, null)
        }
      })
  )

  const customerRows: CustomerRowView[] = profiles.map((p) => {
    const a = authForProfiles.get(p.id)
    return {
      id: p.id,
      email: a?.email ?? null,
      displayName: a?.displayName ?? null,
      evaluation_status: p.evaluation_status,
      evaluation_progress: p.evaluation_progress,
      cumulative_website_value_paid_cents: p.cumulative_website_value_paid_cents,
      stripe_customer_id: p.stripe_customer_id,
      planMonthlyCents: planTotals.get(p.id) ?? null,
      planTipCents: planTips.get(p.id) ?? 0,
      planBadge: planBadges.get(p.id) ?? null,
      websiteAccess: access.get(p.id) ?? null,
      unsoldPurchase: unsold.get(p.id) ?? null,
      updated_at: p.updated_at,
    }
  })

  return (
    <div>
      <AdminMailBanner />
      <h2 className="text-xl font-semibold mb-2">Customers (profiles)</h2>
      <p className="text-sm text-zinc-600 mb-4">
        Evaluation status, cumulative paid (from webhooks), and Stripe customer id. Emails are from Auth — same as sign-in address.
        {allowAdjustCumulativePaid ? (
          <>
            {' '}
            <span className="text-amber-900 font-medium">
              Cumulative paid can be overridden for QA (`ADMIN_ALLOW_ADJUST_CUMULATIVE_PAID`) — does not
              sync Stripe or billing_ledger.
            </span>
          </>
        ) : null}
      </p>
      <form action={adminExpireUnsellableCheckoutsForm} className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <button type="submit" className="rounded border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-800 hover:bg-zinc-50">
          Expire open checkouts for steps not for sale
        </button>
        <span className="text-zinc-600">Run after turning a step&apos;s sellable flag off in ladder.ts. Safe to run again.</span>
        {sp.checkouts_expired !== undefined ? (
          <span role="status" className="text-zinc-800">
            Checked {sp.checkouts_checked ?? '0'} open checkouts: expired {sp.checkouts_expired}, already closed {sp.checkouts_closed ?? '0'}.
          </span>
        ) : null}
        {sp.checkouts_error ? <span role="status" className="text-red-700">Could not reach Stripe. Try again.</span> : null}
      </form>
      <AdminCustomersTable
        rows={filterCustomersByAccess(customerRows, accessFilter)}
        accessFilter={accessFilter}
        totalCount={customerRows.length}
        mailConfigured={mailOn}
        allowAdjustCumulativePaid={allowAdjustCumulativePaid}
      />
    </div>
  )
}
