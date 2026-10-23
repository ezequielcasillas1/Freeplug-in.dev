'use client'

import { useActionState, useState } from 'react'
import { ChecklistFields } from '@/components/consultation/ChecklistFields'
import { checklistSummaryRows, type Checklist } from '@/lib/consultation/checklist'
import type { ConsultationStage } from '@/lib/consultation/status'
import { adminSaveConsultationChecklist, type AdminConsultState } from './actions'

export type AdminConsultationView = {
  id: string
  businessName: string
  requestStatus: string
  clientEmail: string | null
  path: 'form' | 'live'
  method: string | null
  contactNumber: string | null
  bookedAt: string | null
  bookingRef: string | null
  preparedBy: 'client' | 'team'
  stage: ConsultationStage
  stageLabel: string
  readyAt: string | null
  agreedAt: string | null
  agreedIp: string | null
  checklist: Checklist
  consents: { channel: string; phone: string; at: string; text: string }[]
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' }) + ' CT' : '—'

export function AdminConsultationCard({ view }: { view: AdminConsultationView }) {
  const [open, setOpen] = useState(view.stage === 'live_waiting')
  const [state, action, pending] = useActionState(adminSaveConsultationChecklist, {} as AdminConsultState)
  const editable = !view.agreedAt
  const rows = checklistSummaryRows(view.checklist)

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm" data-testid="admin-consultation" data-stage={view.stage}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-900">{view.businessName}</h3>
          <p className="text-xs text-zinc-500">{view.clientEmail ?? 'no email'} · request: {view.requestStatus}</p>
        </div>
        <span className={'rounded px-2 py-0.5 text-xs font-semibold ' + (view.agreedAt ? 'bg-green-100 text-green-800' : view.stage === 'live_waiting' ? 'bg-[#ba3d3d]/10 text-[#ba3d3d]' : 'bg-zinc-100 text-zinc-700')}>
          {view.stageLabel}
        </span>
      </header>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div><dt className="inline text-zinc-500">Path: </dt><dd className="inline">{view.path === 'form' ? 'Fill in the details' : 'Live session'}</dd></div>
        {view.path === 'live' ? (
          <>
            <div><dt className="inline text-zinc-500">Method: </dt><dd className="inline">{view.method}</dd></div>
            <div><dt className="inline text-zinc-500">Booked: </dt><dd className="inline" data-testid="booked-at">{fmt(view.bookedAt)}</dd></div>
            <div><dt className="inline text-zinc-500">Contact: </dt><dd className="inline">{view.contactNumber ?? '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="inline text-zinc-500">Booking: </dt><dd className="inline break-all">{view.bookingRef ?? '—'}</dd></div>
          </>
        ) : null}
        <div><dt className="inline text-zinc-500">Prepared by: </dt><dd className="inline">{view.preparedBy}</dd></div>
        <div><dt className="inline text-zinc-500">Sent for review: </dt><dd className="inline">{fmt(view.readyAt)}</dd></div>
        <div><dt className="inline text-zinc-500">Agreed: </dt><dd className="inline">{fmt(view.agreedAt)}{view.agreedIp ? ` (IP ${view.agreedIp})` : ''}</dd></div>
      </dl>
      {view.consents.length ? (
        <div className="mt-3 rounded bg-zinc-50 p-2 text-xs text-zinc-700">
          <p className="font-medium">Contact consent log</p>
          {view.consents.map((c, i) => (
            <p key={i}>{c.channel} {c.phone} · {fmt(c.at)} · “{c.text}”</p>
          ))}
        </div>
      ) : null}

      <button type="button" className="mt-3 text-sm font-medium text-[#ba3d3d] hover:underline" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide checklist' : editable ? 'Open checklist editor' : 'View agreed checklist'}
      </button>
      {open ? (
        editable ? (
          <form action={action} className="mt-4 space-y-6 border-t border-zinc-100 pt-4">
            <input type="hidden" name="consultation_id" value={view.id} />
            <ChecklistFields initial={view.checklist} />
            {state.error ? <p className="text-sm text-red-600" role="alert">{state.error}</p> : null}
            {state.message ? <p className="text-sm text-green-700" role="status">{state.message}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button type="submit" name="intent" value="ready" disabled={pending} className="rounded-md bg-[#ba3d3d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Save and send to client for review
              </button>
              <button type="submit" name="intent" value="save" disabled={pending} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Save draft
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-3 space-y-1 text-sm">
            {rows.map((r) => (
              <div key={r.label}><dt className="inline text-zinc-500">{r.label}: </dt><dd className="inline whitespace-pre-wrap">{r.value}</dd></div>
            ))}
          </dl>
        )
      ) : null}
    </article>
  )
}
