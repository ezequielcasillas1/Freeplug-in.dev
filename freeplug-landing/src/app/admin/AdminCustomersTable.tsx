import { AdminQuickEmail } from './AdminQuickEmail'
import { AdminTransferNotesCell } from './AdminTransferNotesCell'
import { AdminWebsiteValueCell } from './AdminWebsiteValueCell'

export type CustomerRowView = {
  id: string
  email: string | null
  displayName: string | null
  evaluation_status: string
  evaluation_progress: number
  website_value_target_cents: number | null
  website_transfer_notes: string | null
  cumulative_website_value_paid_cents: number
  stripe_customer_id: string | null
  updated_at: string
}

export function AdminCustomersTable({
  rows,
  smtpConfigured,
}: {
  rows: CustomerRowView[]
  smtpConfigured: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-zinc-600 text-sm">No profile rows.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
          <tr>
            <th className="p-3 font-medium">Account email</th>
            <th className="p-3 font-medium">Name</th>
            <th className="p-3 font-medium">Evaluation</th>
            <th className="p-3 font-medium">Progress</th>
            <th className="p-3 font-medium">Website value</th>
            <th className="p-3 font-medium">Transfer / keys handoff</th>
            <th className="p-3 font-medium">Paid (cumulative)</th>
            <th className="p-3 font-medium">Stripe customer</th>
            <th className="p-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100 align-top">
              <td className="p-3">
                <AdminQuickEmail to={r.email} smtpConfigured={smtpConfigured} />
              </td>
              <td className="p-3 text-zinc-800">{r.displayName ?? '—'}</td>
              <td className="p-3 font-mono text-xs">{r.evaluation_status}</td>
              <td className="p-3">{r.evaluation_progress}%</td>
              <td className="p-3">
                <AdminWebsiteValueCell
                  key={`wv-${r.id}-${r.website_value_target_cents ?? 'x'}`}
                  profileId={r.id}
                  targetCents={r.website_value_target_cents}
                />
              </td>
              <td className="p-3">
                <AdminTransferNotesCell profileId={r.id} notes={r.website_transfer_notes} />
              </td>
              <td className="p-3">${(r.cumulative_website_value_paid_cents / 100).toFixed(2)}</td>
              <td className="p-3 font-mono text-xs break-all max-w-[120px]">
                {r.stripe_customer_id ? (
                  <span title={r.stripe_customer_id}>
                    {r.stripe_customer_id.slice(0, 14)}…
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="p-3 text-zinc-600 whitespace-nowrap text-xs">
                {new Date(r.updated_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
