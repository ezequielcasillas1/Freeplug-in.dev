import { getAuthSummariesByUserIds } from '@/lib/admin/auth-users'
import { isSmtpConfigured } from '@/lib/admin/mail'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminConfigError } from '../AdminConfigError'
import { AdminRequestRow, type AdminRequestRowData } from '../AdminRequestRow'
import { AdminSmtpBanner } from '../AdminSmtpBanner'

export default async function AdminRequestsPage() {
  const smtpOn = isSmtpConfigured()

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
      'id, user_id, business_name, contact_phone, google_business_url, notes, status, created_at, updated_at'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return <p className="text-red-700 text-sm">{error.message}</p>
  }

  const list = rows ?? []
  const authForRequests = await getAuthSummariesByUserIds(
    admin,
    list.map((r) => r.user_id)
  )

  const enrichedRequests: AdminRequestRowData[] = list.map((r) => {
    const a = authForRequests.get(r.user_id)
    return {
      ...r,
      userEmail: a?.email ?? null,
      userDisplayName: a?.displayName ?? null,
    }
  })

  return (
    <div>
      <AdminSmtpBanner />
      <h2 className="text-xl font-semibold mb-4">Website requests</h2>

      {enrichedRequests.length === 0 ? (
        <p className="text-zinc-600 text-sm">No rows yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
              <tr>
                <th className="p-3 font-medium">Created</th>
                <th className="p-3 font-medium">Business</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Account email</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">User id</th>
                <th className="p-3 font-medium">Contact</th>
                <th className="p-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {enrichedRequests.map((r) => (
                <AdminRequestRow key={r.id} row={r} smtpConfigured={smtpOn} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
