import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertAdminAccess } from '@/lib/admin/guard'
import { AdminConfigError } from '../../AdminConfigError'
import {
  ADMIN_BILLING_LABEL,
  ADMIN_CHANGE_REQUEST_COLUMNS,
  ADMIN_STATUS_LABEL,
  adminNotifyLine,
  businessNameOf,
  type AdminChangeRequest,
} from '@/lib/change-requests/admin-view'
import { ChangeRequestDecisionForm, ChangeRequestResendForm } from '../ChangeRequestAdminForms'

type Props = { params: Promise<{ id: string }> }

const ct = (iso: string) => `${new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT`

export default async function AdminChangeRequestPage({ params }: Props) {
  // Phase 5 L-3: the page checks admin access itself before any service-role query (the layout
  // renders concurrently, so its guard alone does not stop this query).
  await assertAdminAccess()
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return <AdminConfigError hint={process.env.NODE_ENV === 'development' ? (e instanceof Error ? e.message : String(e)) : null} />
  }
  const { data, error } = await admin.from('change_requests').select(ADMIN_CHANGE_REQUEST_COLUMNS).eq('id', id).maybeSingle()
  if (error) return <p className="text-red-700 text-sm">{error.message}</p>
  if (!data) notFound()
  const r = data as unknown as AdminChangeRequest

  return (
    <div className="space-y-6">
      <Link href="/admin/change-requests" className="text-sm text-zinc-600 hover:text-[#ba3d3d]">
        ← Change requests
      </Link>
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm space-y-2" data-testid="admin-change-request">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{businessNameOf(r)}</h2>
          <span className="text-xs font-semibold rounded bg-zinc-100 px-2 py-0.5 text-zinc-700" data-status={r.status}>
            {ADMIN_STATUS_LABEL[r.status] ?? r.status}
          </span>
        </div>
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-zinc-500">Type</dt>
          <dd>{r.change_type}</dd>
          <dt className="text-zinc-500">Page</dt>
          <dd className="break-words">{r.page}</dd>
          <dt className="text-zinc-500">Photo</dt>
          <dd>{r.photo_name ? `${r.photo_name} (chosen in the chat; not uploaded)` : '—'}</dd>
          <dt className="text-zinc-500">Plan</dt>
          <dd>{r.plan_step ?? '—'}</dd>
          <dt className="text-zinc-500">Billing</dt>
          <dd>{ADMIN_BILLING_LABEL[r.billing] ?? r.billing}</dd>
          <dt className="text-zinc-500">Sent</dt>
          <dd>{ct(r.created_at)}</dd>
          <dt className="text-zinc-500">Webhook</dt>
          <dd data-testid="admin-change-request-notify">{adminNotifyLine(r)}</dd>
        </dl>
        <p className="whitespace-pre-wrap break-words rounded bg-zinc-50 p-3 text-sm text-zinc-800">{r.description}</p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="font-semibold">Decision (Ezequiel&apos;s PR verdict)</h3>
        {r.status === 'pending_review' ? (
          <ChangeRequestDecisionForm id={r.id} />
        ) : (
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm" data-testid="admin-change-request-decision">
            <dt className="text-zinc-500">Decision</dt>
            <dd>{ADMIN_STATUS_LABEL[r.status] ?? r.status}</dd>
            <dt className="text-zinc-500">When</dt>
            <dd>{r.decided_at ? ct(r.decided_at) : '—'}</dd>
            <dt className="text-zinc-500">Note</dt>
            <dd className="break-words">{r.decision_note ?? '—'}</dd>
            <dt className="text-zinc-500">PR</dt>
            <dd className="break-all">
              {r.pr_url ? (
                <a href={r.pr_url} target="_blank" rel="noreferrer" className="text-[#ba3d3d] hover:underline">
                  {r.pr_url}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </dl>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm space-y-2">
        <h3 className="font-semibold">Webhook</h3>
        <ChangeRequestResendForm id={r.id} />
      </section>
    </div>
  )
}
