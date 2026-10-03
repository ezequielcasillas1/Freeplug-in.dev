'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ADMIN_CANCEL_BUTTON, ADMIN_PUBLISH_BUTTON, ADMIN_PUBLISH_CONFIRM, fill } from '@/lib/outreach/copy'
import {
  ADMIN_DELETE_PHOTOS_BUTTON,
  ADMIN_DELETE_PHOTOS_CONFIRM,
  ADMIN_PHOTOS_MOVED_NOTE,
  ADMIN_REJECT_CONFIRM_BUTTON,
  ADMIN_STALE_NOTE,
  adminClosedPreviewLine,
  adminDeletePhotosLabel,
  adminRejectConfirm,
  adminFieldLabel,
  adminServiceLabel,
} from '@/lib/outreach/admin-labels'
import { displayPhone } from '@/lib/outreach/phone'
import { ADMIN_TONE_CLASSES, type AdminOutreachTone } from '@/lib/outreach/status'
import {
  applySubmissionAction,
  deleteApprovedPhotoFilesAction,
  extendLinkAction,
  publishSiteAction,
  rejectSubmissionAction,
  reviewChangeRequestAction,
  revokeLinkAction,
  submissionPhotosAction,
  unclaimAndReissueAction,
} from './actions'
import { CopyLinkButton } from './CopyLinkButton'

export type AdminOutreachRowView = {
  id: string
  businessName: string
  status: { label: string; tone: AdminOutreachTone }
  expiresAt: string
  claimerEmail: string | null
  planLine: string | null
  cardSaved: boolean
  live: boolean
  liveUrl: string | null
  publishStatus: string
  publishError: string | null
  photoCount: number
  /** Approved photos whose stored copy Freeplug still keeps. */
  storedApprovedPhotoCount: number
  customerConfirmedAt: string | null
  submissions: {
    id: string
    source: string
    fields: Record<string, string>
    services: { name: string; keep: boolean; added: boolean }[]
    photoCount: number
    /** Preview rows: photos carried into the customer's confirmed details (approved there). */
    photosMoved: number
    submittedAt: string
    stale: boolean
  }[]
  /** Old preview rows closed after the customer's row was reviewed (Sable 1:36 AM grey line). */
  closedPreview: { id: string; submittedAt: string; outcome: 'applied' | 'rejected' | 'pending' | 'no_photos' }[]
  changes: { id: string; changeType: string; description: string; createdAt: string }[]
}

const LINK = 'text-sm font-semibold text-[#ba3d3d] hover:underline disabled:opacity-50'
const GREY = 'text-sm text-gray-500 hover:text-gray-800 hover:underline disabled:opacity-50'

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }) + ' CT'
}

/** Photos a Reject on this row would reject: its own plus carried ones, minus those moved elsewhere. */
function rejectablePhotos(s: AdminOutreachRowView['submissions'][number]): number {
  return Math.max(0, s.photoCount - s.photosMoved)
}

export function AdminOutreachRow({ row }: { row: AdminOutreachRowView }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // The submission whose Reject is waiting for "Reject details and photos" (Sable 1:34 AM).
  const [confirmingReject, setConfirmingReject] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [liveUrl, setLiveUrl] = useState(row.liveUrl ?? '')
  const [photos, setPhotos] = useState<Record<string, string[]>>({})

  async function run(fn: () => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fn()
      if (!res.ok) setMsg(res.error ?? 'Failed.')
      else if (typeof res.link === 'string') setNewLink(res.link)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  // Red Publish only once a card is on file (setup-mode Checkout finished); it opens the
  // "This starts billing for {Business}." confirmation. Never while a publish is in flight.
  const canPublish = !row.live && row.cardSaved && row.claimerEmail !== null && row.publishStatus !== 'processing'

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm" data-testid="admin-outreach-row">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-gray-900">{row.businessName}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ADMIN_TONE_CLASSES[row.status.tone]}`}>{row.status.label}</span>
        {row.submissions.length > 0 ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Details to review</span>
        ) : null}
        {row.changes.length > 0 ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            {row.changes.length} change request{row.changes.length === 1 ? '' : 's'}
          </span>
        ) : null}
        {canPublish && !confirming && !confirmingDelete && !confirmingReject ? (
          <Button size="sm" className="ml-auto" onClick={() => setConfirming(true)} disabled={busy} data-testid="admin-publish">
            Publish
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Link expires {when(row.expiresAt)}
        {row.claimerEmail ? ` · Claimed by ${row.claimerEmail}` : ''}
        {row.planLine ? ` · ${row.planLine}` : ''}
        {row.cardSaved && !row.live ? ' · Card saved' : ''}
        {` · ${row.photoCount} photo${row.photoCount === 1 ? '' : 's'}`}
        {row.customerConfirmedAt ? ` · Details confirmed ${when(row.customerConfirmedAt)}` : ''}
      </p>
      {row.publishStatus === 'failed' && row.publishError ? (
        <p className="mt-1 text-sm text-amber-800" role="status">
          Not published: {row.publishError}
        </p>
      ) : null}
      {row.publishStatus === 'processing' ? <p className="mt-1 text-sm text-gray-600">Publishing: waiting for the first invoice to be paid.</p> : null}

      {confirming ? (
        <div className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3" data-testid="publish-confirm">
          <p className="text-sm font-medium text-gray-900">{fill(ADMIN_PUBLISH_CONFIRM, { Business: row.businessName })}</p>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Claimer verified as the business
          </label>
          <div>
            <label htmlFor={`live-${row.id}`} className="block text-xs font-medium text-gray-600 mb-1">
              Live website address (optional)
            </label>
            <input
              id={`live-${row.id}`}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#ba3d3d]"
              placeholder="https://"
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              disabled={busy || !verified}
              onClick={() =>
                run(async () => {
                  const r = await publishSiteAction(row.id, verified, liveUrl)
                  if (r.ok) setConfirming(false)
                  return r
                })
              }
            >
              {ADMIN_PUBLISH_BUTTON}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              {ADMIN_CANCEL_BUTTON}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-4">
        {!row.claimerEmail && row.status.label !== 'Revoked' ? (
          <>
            <button type="button" className={LINK} disabled={busy} onClick={() => run(() => extendLinkAction(row.id))}>
              Extend 30 days
            </button>
            <button type="button" className={GREY} disabled={busy} onClick={() => run(() => revokeLinkAction(row.id))}>
              Revoke
            </button>
          </>
        ) : null}
        {!row.live ? (
          <button type="button" className={GREY} disabled={busy} onClick={() => run(() => unclaimAndReissueAction(row.id))}>
            {row.claimerEmail ? 'Unclaim and reissue' : 'Reissue link'}
          </button>
        ) : null}
        {row.storedApprovedPhotoCount > 0 && !confirmingDelete ? (
          // Sable 1:02 AM. Use after the approved photos are on the site; asks first.
          <button type="button" className={GREY} disabled={busy} onClick={() => setConfirmingDelete(true)} data-testid="delete-photos-link">
            {adminDeletePhotosLabel(row.storedApprovedPhotoCount)}
          </button>
        ) : null}
      </div>
      {confirmingDelete ? (
        <div className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3" data-testid="delete-photos-confirm">
          <p className="text-sm text-gray-900">{ADMIN_DELETE_PHOTOS_CONFIRM}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await deleteApprovedPhotoFilesAction(row.id)
                  if (r.ok) setConfirmingDelete(false)
                  return r
                })
              }
            >
              {ADMIN_DELETE_PHOTOS_BUTTON}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={busy}>
              {ADMIN_CANCEL_BUTTON}
            </Button>
          </div>
        </div>
      ) : null}
      {newLink ? (
        <div className="mt-3">
          <CopyLinkButton link={newLink} />
        </div>
      ) : null}
      {msg ? <p className="mt-2 text-sm text-red-700">{msg}</p> : null}

      {row.submissions.map((s) => (
        <div key={s.id} className="mt-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-sm" data-testid="pending-submission">
          <p className="text-xs text-gray-500">
            From the {s.source === 'preview' ? 'preview' : 'customer'} · {when(s.submittedAt)}
            {s.stale ? ` · ${ADMIN_STALE_NOTE}` : ''}
          </p>
          <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {Object.entries(s.fields)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                // min-w-0 + break-words: long values wrap at 375 instead of widening the page (Vera r3).
                <div key={k} className="min-w-0 break-words">
                  <dt className="inline text-gray-500">{adminFieldLabel(k)}: </dt>
                  <dd className="inline break-words text-gray-900">{k === 'phone' ? displayPhone(v) : v}</dd>
                </div>
              ))}
          </dl>
          {s.services.length > 0 ? (
            <p className="mt-1 text-gray-700" data-testid="submission-services">
              Services: {s.services.map(adminServiceLabel).join(', ')}
            </p>
          ) : null}
          {s.photosMoved > 0 ? (
            <p className="mt-1 text-gray-700" data-testid="photos-moved-note">
              {ADMIN_PHOTOS_MOVED_NOTE}
            </p>
          ) : null}
          {s.photoCount > 0 ? (
            <div className="mt-1">
              <button
                type="button"
                className={LINK}
                onClick={async () => setPhotos({ ...photos, [s.id]: await submissionPhotosAction(s.id) })}
              >
                View {s.photoCount} photo{s.photoCount === 1 ? '' : 's'}
              </button>
              {photos[s.id] ? (
                <div className="mt-2 grid grid-cols-5 gap-2 md:grid-cols-10">
                  {photos[s.id].map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                      <img src={u} alt="" className="aspect-square w-full rounded object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-2 flex gap-4">
            <button type="button" className={LINK} disabled={busy || s.stale} onClick={() => run(() => applySubmissionAction(s.id))}>
              Apply
            </button>
            {confirmingReject !== s.id ? (
              <button
                type="button"
                className={GREY}
                disabled={busy}
                onClick={() => (rejectablePhotos(s) > 0 ? setConfirmingReject(s.id) : run(() => rejectSubmissionAction(s.id)))}
              >
                Reject
              </button>
            ) : null}
          </div>
          {confirmingReject === s.id ? (
            <div className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3" data-testid="reject-confirm">
              <p className="text-sm text-gray-900">{adminRejectConfirm(rejectablePhotos(s))}</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const r = await rejectSubmissionAction(s.id)
                      setConfirmingReject(null)
                      return r
                    })
                  }
                >
                  {ADMIN_REJECT_CONFIRM_BUTTON}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingReject(null)} disabled={busy}>
                  {ADMIN_CANCEL_BUTTON}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ))}

      {row.closedPreview.map((c) => (
        // Sable 1:36 AM / Lina: one grey line, the send time, no Apply or Reject.
        <p key={c.id} className="mt-2 text-xs text-gray-500" data-testid="closed-preview-row">
          From the preview · {when(c.submittedAt)} · {adminClosedPreviewLine(c.outcome)}
        </p>
      ))}

      {row.changes.map((c) => (
        <div key={c.id} className="mt-3 rounded-lg border border-zinc-200 p-3 text-sm">
          <p className="text-xs text-gray-500">
            Change request · {c.changeType} · {when(c.createdAt)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-gray-900">{c.description}</p>
          <div className="mt-2 flex gap-4">
            <button type="button" className={LINK} disabled={busy} onClick={() => run(() => reviewChangeRequestAction(c.id, 'applied'))}>
              Mark done
            </button>
            <button type="button" className={GREY} disabled={busy} onClick={() => run(() => reviewChangeRequestAction(c.id, 'rejected'))}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </li>
  )
}
