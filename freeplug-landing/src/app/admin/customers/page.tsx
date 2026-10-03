import { getAuthSummariesByUserIds } from '@/lib/admin/auth-users'
import { isMailConfigured } from '@/lib/admin/mail'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanMonthlyTotalCents } from '@/lib/stripe/active-subscription'
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

type Props = { searchParams: Promise<{ access?: string }> }

export default async function AdminCustomersPage({ searchParams }: Props) {
  const accessFilter = parseAccessFilter((await searchParams).access)
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

  const allowAdjustCumulativePaid = process.env.ADMIN_ALLOW_ADJUST_CUMULATIVE_PAID === 'true'

  // Monthly plan totals from Stripe (for the Priority badge). A failed lookup just shows no amount.
  const planTotals = new Map<string, number | null>()
  // Website access (hosting required) from Stripe, for the badge column and the offline filter.
  // Taking a site offline or restoring it stays manual.
  const access = new Map<string, { status: WebsiteAccessStatus; label: string } | null>()
  await Promise.all(
    profiles
      .filter((p) => p.stripe_customer_id)
      .map(async (p) => {
        try {
          planTotals.set(p.id, await getPlanMonthlyTotalCents(p.stripe_customer_id as string))
        } catch (e) {
          console.error('[admin/customers] plan total lookup failed', e instanceof Error ? e.message : e)
          planTotals.set(p.id, null)
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
      websiteAccess: access.get(p.id) ?? null,
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
