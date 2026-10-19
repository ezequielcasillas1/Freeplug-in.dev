import { getAuthSummariesByUserIds } from '@/lib/admin/auth-users'
import { isMailConfigured } from '@/lib/admin/mail'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminConfigError } from '../AdminConfigError'
import { AdminRequestRow, type AdminRequestRowData } from '../AdminRequestRow'
import { AdminMailBanner } from '../AdminMailBanner'
import { compareQueue, resolvePlanStep } from '@/lib/plans/ladder'
import { fetchBuyoutCredit } from '@/lib/buyout/ownership'

export default async function AdminRequestsPage() {
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

  const { data: rows, error } = await admin
    .from('website_requests')
    .select(
      'id, user_id, business_name, contact_phone, google_business_url, notes, buyout_price_cents, is_buyout, status, due_by, created_at, updated_at'
    )
    .order('created_at', { ascending: true })

  if (error) {
    return <p className="text-red-700 text-sm">{error.message}</p>
  }

  const list = rows ?? []
  const authForRequests = await getAuthSummariesByUserIds(
    admin,
    list.map((r) => r.user_id)
  )

  // Hosting ladder: queue order = plan step (profiles.plan_step, cached by the Stripe webhook),
  // highest first, then oldest first within a step. A failed lookup sorts everyone as "no plan".
  const userIds = [...new Set(list.map((r) => r.user_id))]
  const stepByUser = new Map<string, string | null>()
  if (userIds.length > 0) {
    const { data: profs, error: profErr } = await admin.from('profiles').select('id, plan_step').in('id', userIds)
    if (profErr) console.error('[admin/requests] plan step lookup failed', profErr.message)
    for (const p of profs ?? []) stepByUser.set(p.id as string, (p.plan_step as string | null) ?? null)
  }

  // Buyout eligibility reads ownership_ledger: cleared payments only (14+ days), refunds/disputes subtracted.
  let creditByUser = new Map<string, number>()
  const buyoutUsers = [...new Set(list.filter((r) => r.is_buyout).map((r) => r.user_id as string))]
  try {
    creditByUser = await fetchBuyoutCredit(admin as unknown as Parameters<typeof fetchBuyoutCredit>[0], buyoutUsers)
  } catch (e) {
    console.error('[admin/requests] buyout credit lookup failed', e instanceof Error ? e.message : e)
  }

  const enrichedRequests: AdminRequestRowData[] = list
    .map((r) => {
      const a = authForRequests.get(r.user_id)
      const step = resolvePlanStep(stepByUser.get(r.user_id))
      return {
        ...r,
        userEmail: a?.email ?? null,
        userDisplayName: a?.displayName ?? null,
        planStepId: step?.id ?? null,
        planStepName: step?.name ?? null,
        priorityRank: step?.rank ?? -1,
        buyoutClearedCents: r.is_buyout ? (creditByUser.get(r.user_id) ?? null) : null,
      }
    })
    .sort(compareQueue)

  return (
    <div>
      <AdminMailBanner />
      <h2 className="text-xl font-semibold mb-4">Website requests</h2>

      {enrichedRequests.length === 0 ? (
        <p className="text-zinc-600 text-sm">No rows yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
              <tr>
                <th className="p-3 font-medium">Created / due</th>
                <th className="p-3 font-medium">Business</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Account email</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Contact</th>
                <th className="p-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {enrichedRequests.map((r) => (
                <AdminRequestRow key={r.id} row={r} mailConfigured={mailOn} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
