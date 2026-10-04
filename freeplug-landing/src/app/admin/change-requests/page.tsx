import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminConfigError } from '../AdminConfigError'
import {
  ADMIN_BILLING_LABEL,
  ADMIN_CHANGE_REQUEST_COLUMNS,
  ADMIN_STATUS_LABEL,
  adminNotifyLine,
  businessNameOf,
  type AdminChangeRequest,
} from '@/lib/change-requests/admin-view'

export default async function AdminChangeRequestsPage() {
  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return <AdminConfigError hint={process.env.NODE_ENV === 'development' ? (e instanceof Error ? e.message : String(e)) : null} />
  }
  const { data, error } = await admin
    .from('change_requests')
    .select(ADMIN_CHANGE_REQUEST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return <p className="text-red-700 text-sm">{error.message}</p>
  const rows = (data ?? []) as unknown as AdminChangeRequest[]

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Change requests</h2>
      <p className="text-sm text-zinc-600 mb-4">From the Help chat. Approve or Decline records Ezequiel&apos;s PR verdict; it charges nothing.</p>
      {rows.length === 0 ? (
        <p className="text-zinc-600 text-sm">No change requests yet.</p>
      ) : (
        <ul className="space-y-3" data-testid="admin-change-requests">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/admin/change-requests/${r.id}`} className="font-semibold text-[#ba3d3d] hover:underline">
                  {businessNameOf(r)}: {r.change_type} · {r.page}
                </Link>
                <span className="text-xs font-semibold rounded bg-zinc-100 px-2 py-0.5 text-zinc-700" data-status={r.status}>
                  {ADMIN_STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT · Billing: {ADMIN_BILLING_LABEL[r.billing] ?? r.billing} · Webhook: {adminNotifyLine(r)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
