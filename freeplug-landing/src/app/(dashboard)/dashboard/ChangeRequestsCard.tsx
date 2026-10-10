import { CHANGE_REQUESTS_EMPTY, CHANGE_REQUESTS_HEADING, customerStatusLines } from '@/lib/change-requests/copy'
import type { CustomerChangeRequest } from '@/lib/change-requests/customer'
import { ChangeRequestText } from './ChangeRequestText'

const STATUS_STYLE: Record<string, string> = {
  pending_review: 'bg-amber-50 text-amber-900 border-amber-200',
  approved: 'bg-green-50 text-green-900 border-green-200',
  declined: 'bg-zinc-100 text-zinc-800 border-zinc-300',
}

/** Short date in Central time (data, not copy: no words). */
const sentDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })

/**
 * Dashboard "Your change requests" (Aria spec item 5, Sable's final words Oct 4 3:14 PM CT):
 * one line per Help-chat change with its status. "Approved" never says when a change goes live.
 */
export function ChangeRequestsCard({ requests }: { requests: readonly CustomerChangeRequest[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm" data-testid="change-requests-card">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">{CHANGE_REQUESTS_HEADING}</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-gray-700" data-testid="change-requests-empty">
          {CHANGE_REQUESTS_EMPTY}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {requests.map((r) => {
            const { label, detail } = customerStatusLines(r.status, r.decision_note)
            const status = STATUS_STYLE[r.status] ? r.status : 'pending_review'
            return (
              <li key={r.id} className="py-3 first:pt-0 last:pb-0" data-testid="change-request-item" data-status={status}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 break-words">
                      {r.change_type} · {r.page}
                    </p>
                    <p className="text-xs text-gray-500">{sentDate(r.created_at)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}
                    data-testid="change-request-status"
                  >
                    {label}
                  </span>
                </div>
                <ChangeRequestText id={r.id} text={r.description} />
                {detail ? (
                  <p
                    className="mt-2 border-l-2 border-gray-300 pl-3 text-sm text-gray-600 break-words"
                    data-testid="change-request-detail"
                  >
                    {detail}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
