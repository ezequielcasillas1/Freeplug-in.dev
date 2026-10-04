'use client'

import { useActionState } from 'react'
import { adminDecideChangeRequest, adminResendChangeRequest, type AdminChangeActionState } from './actions'

const initial: AdminChangeActionState = {}

function Result({ state }: { state: AdminChangeActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-red-700">{state.error}</p>
  if (state.message) return <p role="status" className="text-sm text-green-800">{state.message}</p>
  return null
}

/** Records Ezequiel's PR verdict. Approve charges nothing and starts nothing. */
export function ChangeRequestDecisionForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(adminDecideChangeRequest, initial)
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
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          data-testid="change-request-approve"
          className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="submit"
          name="decision"
          value="declined"
          disabled={pending}
          data-testid="change-request-decline"
          className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Decline
        </button>
      </div>
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
