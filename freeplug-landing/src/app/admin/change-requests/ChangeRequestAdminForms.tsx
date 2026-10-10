'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { adminDecideChangeRequest, adminResendChangeRequest, type AdminChangeActionState } from './actions'

const initial: AdminChangeActionState = {}
type Decision = 'approved' | 'declined'

function Result({ state }: { state: AdminChangeActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>
  if (state.message) return <p role="status" className="text-sm text-green-800">{state.message}</p>
  return null
}

export const CONFIRM_COPY: Record<Decision, { title: string; body: string; yes: string }> = {
  approved: {
    title: 'Approve this change request?',
    body: 'This only records your PR verdict. It charges nothing and starts no work. The customer will see "Approved". You can\'t change the decision after.',
    yes: 'Yes, approve',
  },
  declined: {
    title: 'Decline this change request?',
    body: 'The customer will see "Not approved" and your note, or the support line if there is no note. You can\'t change the decision after.',
    yes: 'Yes, decline',
  },
}

/**
 * Records Ezequiel's PR verdict. Approve charges nothing and starts nothing.
 * Aria ruling 5: Approve / Decline open an accessible confirm step (focus moves to it, Escape or
 * Cancel returns focus to the button); only "Yes, approve" / "Yes, decline" submits (confirmed=yes).
 */
export function ChangeRequestDecisionForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(adminDecideChangeRequest, initial)
  // The confirm step belongs to the action state it was opened on: when the action answers (an
  // error comes back as a new state) the step closes by itself, so the error is visible.
  const [opened, setOpened] = useState<{ decision: Decision; on: AdminChangeActionState } | null>(null)
  const confirming: Decision | null = opened && opened.on === state ? opened.decision : null
  const titleRef = useRef<HTMLHeadingElement>(null)
  const approveRef = useRef<HTMLButtonElement>(null)
  const declineRef = useRef<HTMLButtonElement>(null)
  const lastOpened = useRef<Decision | null>(null)

  useEffect(() => {
    if (confirming) titleRef.current?.focus()
  }, [confirming])
  const open = (d: Decision) => {
    lastOpened.current = d
    setOpened({ decision: d, on: state })
  }
  const cancel = () => {
    setOpened(null)
    const back = lastOpened.current === 'declined' ? declineRef : approveRef
    requestAnimationFrame(() => back.current?.focus())
  }
  const copy = confirming ? CONFIRM_COPY[confirming] : null

  return (
    <form action={action} className="space-y-3" data-testid="change-request-decision-form">
      <input type="hidden" name="id" value={id} />
      <label className="block text-sm">
        <span className="font-medium text-zinc-800">Note (optional, up to 500 characters)</span>
        <span className="block text-xs text-zinc-500">The customer sees it only when the request is not approved.</span>
        <textarea name="note" maxLength={500} rows={3} className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm" />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-zinc-800">PR link (optional, admin only)</span>
        <input
          name="pr_url"
          type="url"
          inputMode="url"
          placeholder="https://github.com/owner/repo/pull/123"
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
        />
      </label>
      <p className="text-xs text-zinc-500">Approve only records the decision. It charges nothing and starts no work.</p>
      <div className="flex flex-wrap gap-2">
        <button
          ref={approveRef}
          type="button"
          onClick={() => open('approved')}
          disabled={pending || confirming !== null}
          aria-haspopup="true"
          aria-expanded={confirming === 'approved'}
          aria-controls="change-request-confirm"
          data-testid="change-request-approve"
          className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          ref={declineRef}
          type="button"
          onClick={() => open('declined')}
          disabled={pending || confirming !== null}
          aria-haspopup="true"
          aria-expanded={confirming === 'declined'}
          aria-controls="change-request-confirm"
          data-testid="change-request-decline"
          className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {confirming && copy ? (
        <div
          id="change-request-confirm"
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="change-request-confirm-title"
          aria-describedby="change-request-confirm-body"
          data-testid="change-request-confirm"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
          className="rounded-md border border-amber-300 bg-amber-50 p-3"
        >
          <h3 id="change-request-confirm-title" ref={titleRef} tabIndex={-1} className="text-sm font-semibold text-zinc-900 outline-none">
            {copy.title}
          </h3>
          <p id="change-request-confirm-body" className="mt-1 text-sm text-zinc-700">
            {copy.body}
          </p>
          <input type="hidden" name="confirmed" value="yes" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              name="decision"
              value={confirming}
              disabled={pending}
              data-testid="change-request-confirm-yes"
              className={`rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${confirming === 'approved' ? 'bg-green-700' : 'bg-zinc-700'}`}
            >
              {pending ? 'Saving…' : copy.yes}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              data-testid="change-request-confirm-cancel"
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <Result state={state} />
    </form>
  )
}

export function ChangeRequestResendForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(adminResendChangeRequest, initial)
  return (
    <form action={action} className="space-y-2" data-testid="change-request-resend-form">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        data-testid="change-request-resend"
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Resend'}
      </button>
      <p className="text-xs text-zinc-500">Sends this request to the approval routine again (one try).</p>
      <Result state={state} />
    </form>
  )
}
