import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdminAccess } from '@/lib/admin/guard'
import { AdminConfigError } from '../AdminConfigError'
import {
  ADMIN_BILLING_LABEL,
  ADMIN_CHANGE_REQUEST_COLUMNS,
  ADMIN_STATUS_LABEL,
  adminNotifyLine,
  businessNameOf,
  type AdminChangeRequest,
} from '@/lib/change-requests/admin-view'
import { MaintenanceQuoteControls, QuoteBadge, type RowQuote } from './MaintenanceQuoteControls'

export default async function AdminChangeRequestsPage() {
  // Phase 5 L-3: the page checks admin access itself before any service-role query (the layout
  // renders concurrently, so its guard alone does not stop this query).
  await assertAdminAccess()
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
  // Oct 18: each row's live maintenance quote; with none live, its latest voided one stays visible ("Void" badge).
  // A read error just hides the badges.
  const quotes = new Map<string, RowQuote>()
  if (rows.length > 0) {
    const { data: q } = await admin
      .from('maintenance_quotes')
      .select('id, change_request_id, status, amount_cents, description, sent_at, created_at')
      .in('change_request_id', rows.map((r) => r.id))
      .order('created_at', { ascending: true })
    for (const x of (q ?? []) as (NonNullable<RowQuote> & { change_request_id: string })[]) {
      const prev = quotes.get(x.change_request_id)
      if (!prev || prev.status === 'void') quotes.set(x.change_request_id, x)
    }
  }

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
                <span className="flex flex-wrap items-center gap-2">
                  <QuoteBadge quote={quotes.get(r.id) ?? null} />
                  <span className="text-xs font-semibold rounded bg-zinc-100 px-2 py-0.5 text-zinc-700" data-status={r.status}>
                    {ADMIN_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT · Billing: {ADMIN_BILLING_LABEL[r.billing] ?? r.billing} · Webhook: {adminNotifyLine(r)}
              </p>
              <MaintenanceQuoteControls changeRequestId={r.id} quote={quotes.get(r.id) ?? null} customerName={businessNameOf(r)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
