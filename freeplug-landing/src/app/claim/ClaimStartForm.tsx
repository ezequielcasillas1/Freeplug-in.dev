'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { CLAIM_CARD_HEADING, CLAIM_CARD_LINE, CLAIM_LABEL, CLAIM_STALE_LINE, fill } from '@/lib/outreach/copy'
import { ConfirmEmailBox } from '@/components/outreach/ConfirmEmailBox'

const CARD = 'rounded-xl border border-zinc-200 bg-white p-6 shadow-sm'

/**
 * The claim-start card on /claim (Sable 1:46 AM, Lina gap 1): the preview banner's card layout,
 * heading, one grey line, then the one red "Claim my website" button. The page renders it only
 * after the preview link checks out, so `businessName` is never shown for a bad link (Jace).
 *
 * The button sends the claim as a same-site POST to /claim/start (Vera r2 bug 9) with the form
 * token. `auto`: submit on load (page opened from this site, e.g. right after sign-up); otherwise
 * the person taps the button. `stale` (Sable 1:45 AM): the previous token ran out, so the grey line
 * says the page was refreshed, and it never submits by itself.
 */
export function ClaimStartForm({
  auto,
  token,
  businessName,
  stale = false,
  unconfirmedEmail = null,
}: {
  auto: boolean
  token: string
  businessName: string
  stale?: boolean
  /** Round 7: the signed-in user's own unconfirmed address -> the amber confirm-email box on top. */
  unconfirmedEmail?: string | null
}) {
  const form = useRef<HTMLFormElement>(null)
  const sent = useRef(false)
  const submitOnLoad = auto && !stale
  useEffect(() => {
    if (submitOnLoad && !sent.current && form.current) {
      sent.current = true
      form.current.requestSubmit()
    }
  }, [submitOnLoad])
  return (
    <div className={CARD} data-testid="claim-start-card">
      {unconfirmedEmail ? <ConfirmEmailBox email={unconfirmedEmail} /> : null}
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{fill(CLAIM_CARD_HEADING, { 'Business Name': businessName })}</h1>
      <p className="mt-2 text-gray-600" data-testid="claim-card-line" data-stale={stale ? 'true' : 'false'}>
        {stale ? CLAIM_STALE_LINE : CLAIM_CARD_LINE}
      </p>
      <form ref={form} method="post" action="/claim/start" className="mt-5" data-testid="claim-start-form">
        <input type="hidden" name="t" value={token} />
        <Button type="submit" className="w-full min-h-[48px] md:w-auto" data-emphasis="red">
          {CLAIM_LABEL}
        </Button>
      </form>
    </div>
  )
}
