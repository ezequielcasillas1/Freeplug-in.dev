'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { ConfirmEmailBox } from './ConfirmEmailBox'
import {
  CALL_ARIA,
  CALL_US_LABEL,
  EMAIL_ARIA,
  EMAIL_US_LABEL,
  GO_TO_DASHBOARD_LABEL,
  NEUTRAL_BODY,
  NEUTRAL_HEADING,
  NEUTRAL_HELP_LINE,
  NEUTRAL_HELP_PHONE,
  TEXT_ARIA,
  TEXT_US_LABEL,
} from '@/lib/outreach/copy'
import { SUPPORT_MAILTO, SUPPORT_SMS_HREF, SUPPORT_TEL_HREF } from '@/lib/site'

const CARD = 'rounded-xl border border-zinc-200 bg-white p-6 shadow-sm'
/** The preview's grey bordered contact buttons (PreviewView PHONE_CONTACT), >= 44px tall. */
const GREY_BUTTON =
  'flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm font-medium text-gray-800 hover:bg-zinc-50'

/**
 * Jace's neutral page (round 6; Sable 1:57 AM, Lina 1:58 AM): /claim for a signed-in person with no
 * saved claim and no valid preview link in this browser (none, bad, expired, revoked, or claimed by
 * someone else). Nothing about the link reaches it, so it is the same page in every one of those
 * cases: it names no business and can't be used to tell whether a link or business exists. Same
 * card as the claim card, no solid red button.
 *
 * Round 7: `unconfirmedEmail` (the signed-in user's OWN address, from the verified session, only
 * when it isn't confirmed) adds the amber confirm-email box at the top (Sable 2:08 AM). "Go to my
 * dashboard" is the standard red outline secondary button, as on the waiting screen (Lina).
 */
export function ClaimNeutralCard({ unconfirmedEmail = null }: { unconfirmedEmail?: string | null }) {
  return (
    <div className={CARD} data-testid="claim-neutral-card">
      {unconfirmedEmail ? <ConfirmEmailBox email={unconfirmedEmail} /> : null}
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{NEUTRAL_HEADING}</h1>
      <p className="mt-2 text-gray-600">{NEUTRAL_BODY}</p>
      {/* Desktop: the one help line. */}
      <p className="mt-4 hidden text-sm text-gray-600 md:block" data-testid="neutral-help-desktop">
        {NEUTRAL_HELP_LINE}
      </p>
      {/* Phone: grey text above the preview's three grey bordered buttons. */}
      <div className="mt-4 md:hidden" data-testid="neutral-help-phone">
        <p className="text-sm text-gray-500">{NEUTRAL_HELP_PHONE}</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <a href={SUPPORT_TEL_HREF} aria-label={CALL_ARIA} className={GREY_BUTTON}>
            {CALL_US_LABEL}
          </a>
          <a href={SUPPORT_SMS_HREF} aria-label={TEXT_ARIA} className={GREY_BUTTON}>
            {TEXT_US_LABEL}
          </a>
          <a href={SUPPORT_MAILTO} aria-label={EMAIL_ARIA} className={GREY_BUTTON}>
            {EMAIL_US_LABEL}
          </a>
        </div>
      </div>
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'mt-5 w-full min-h-[44px] md:w-auto')}
        data-emphasis="outline"
        data-testid="neutral-dashboard"
      >
        {GO_TO_DASHBOARD_LABEL}
      </Link>
    </div>
  )
}
