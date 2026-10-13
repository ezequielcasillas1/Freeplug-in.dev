import { NextResponse, type NextRequest } from 'next/server'
import { emailBaseUrl } from '@/lib/site'
import { resendSignupConfirmation, type ResendOutcome } from '@/lib/outreach/resend-confirmation'
import { isSameOriginPost } from '../start/claim-redirect'

export const dynamic = 'force-dynamic'

const STATUS: Record<ResendOutcome, number> = { sent: 200, confirmed: 200, limited: 429, error: 502, signed_out: 401 }

const json = (outcome: ResendOutcome | 'forbidden', status: number) =>
  NextResponse.json({ outcome }, { status, headers: { 'cache-control': 'private, no-store' } })

/**
 * POST /claim/resend (round 7): "Send it again" in the confirm-email box. Same-site POST only, with
 * the same checks as /claim/start (a GET gets 405; a cross-site POST gets 403 and sends nothing).
 * Only for the signed-in, unconfirmed user, to their own address: the request body and query are
 * never read. See resendSignupConfirmation for the rate limits.
 */
export async function POST(request: NextRequest) {
  const h = request.headers
  if (!isSameOriginPost(h.get('origin'), h.get('sec-fetch-site'), request.url, emailBaseUrl())) return json('forbidden', 403)
  const outcome = await resendSignupConfirmation()
  return json(outcome, STATUS[outcome])
}
