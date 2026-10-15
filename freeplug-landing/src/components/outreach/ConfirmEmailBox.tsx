'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CONFIRM_FIRST_LINE, GENERIC_TRY_AGAIN, RESEND_LABEL, RESEND_LIMITED, RESEND_SENT, fill } from '@/lib/outreach/copy'

type State = 'idle' | 'sending' | 'sent' | 'limited' | 'error'

/**
 * Light amber box at the top of the claim flow's card for a signed-in user whose email isn't
 * confirmed (round 7; Sable 2:08/2:10 AM). `email` is the signed-in user's own address, passed by
 * the server page from the verified session; it is never read from a URL.
 * "Send it again" is a text link (styled as one; a <button> because it performs an action) that
 * POSTs to /claim/resend with no body. After a send it reads "Sent. Check your inbox."; when rate
 * limited, the limit line replaces it; any other failure shows the generic error and keeps the link.
 * An account that turns out to be confirmed already just reloads the page, which moves on.
 */
export function ConfirmEmailBox({ email }: { email: string }) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')

  async function resend() {
    if (state === 'sending') return
    setState('sending')
    try {
      const res = await fetch('/claim/resend', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
      const body = (await res.json().catch(() => null)) as { outcome?: string } | null
      const outcome = body?.outcome
      if (outcome === 'sent') setState('sent')
      else if (outcome === 'limited') setState('limited')
      else if (outcome === 'confirmed') {
        setState('idle')
        router.refresh()
      } else setState('error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="confirm-email-box">
      <p>{fill(CONFIRM_FIRST_LINE, { 'account email': email })}</p>
      <div className="mt-2" aria-live="polite">
        {state === 'sent' ? (
          <p role="status" data-testid="resend-sent">
            {RESEND_SENT}
          </p>
        ) : state === 'limited' ? (
          <p role="status" data-testid="resend-limited">
            {RESEND_LIMITED}
          </p>
        ) : (
          <>
            {state === 'error' ? (
              <p role="alert" className="mb-1 text-red-700" data-testid="resend-error">
                {GENERIC_TRY_AGAIN}
              </p>
            ) : null}
            <button
              type="button"
              onClick={resend}
              disabled={state === 'sending'}
              className="inline-flex min-h-[44px] items-center font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 disabled:opacity-60"
              data-testid="resend-link"
            >
              {RESEND_LABEL}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
