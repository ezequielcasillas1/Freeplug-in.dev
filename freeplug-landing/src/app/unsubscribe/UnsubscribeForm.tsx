'use client'

import { useActionState } from 'react'
import { confirmUnsubscribe, type UnsubscribeState } from './actions'
import { UNSUBSCRIBE_COPY as C } from './copy'

export function UnsubscribeForm({ email, t }: { email: string; t: string }) {
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(confirmUnsubscribe, { status: 'idle' })
  if (state.status === 'done') {
    return (
      <p className="text-lg text-gray-700" data-testid="unsubscribe-done" role="status">
        {C.done(email)}
      </p>
    )
  }
  return (
    <form action={action} className="space-y-6" data-testid="unsubscribe-form">
      <p className="text-lg text-gray-700">{C.confirm(email)}</p>
      <input type="hidden" name="t" value={t} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ba3d3d] text-white font-medium hover:bg-[#a53434] transition-colors disabled:opacity-60"
      >
        {pending ? C.working : C.button}
      </button>
      {state.status === 'error' ? (
        <p className="text-sm text-red-700" role="alert">
          {C.error}
        </p>
      ) : null}
    </form>
  )
}
