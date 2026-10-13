import { createHmac, timingSafeEqual } from 'node:crypto'
import { outreachCookieSecret } from '@/lib/outreach/cookie'
import type { ClaimOutcome } from '@/lib/outreach/server'

/**
 * Where /claim/start sends the browser after running the claim (Vera QA #1). The claim runs in
 * the route handler and the steps render on a NEW request to /claim, so the page never reads a
 * site lookup that was made (and memoized by Next) before the claim was written.
 */
export function claimRedirectPath(out: ClaimOutcome): string {
  if (out.ok) return '/claim'
  if (out.reason === 'no_link' || out.reason === 'email_unconfirmed') return `/claim?claim=${out.reason}`
  return '/claim?claim=invalid'
}

/**
 * Vera r2 bug 9: /claim/start changes data, so it only takes a POST from this site's own /claim
 * page. Two checks:
 *   1. No cross-site signal: an Origin header, when the browser sends a real one, must be this site
 *      (the request's own origin or NEXT_PUBLIC_APP_URL), and Sec-Fetch-Site, when sent, must be
 *      "same-origin". The claim pages use Referrer-Policy: no-referrer (Vera rule 5), and with that
 *      policy browsers send "Origin: null" on a same-site form POST, so "null" alone can't be
 *      refused here or nobody could claim.
 *   2. A short-lived form token signed for the signed-in user (claimStartToken), which only /claim
 *      renders. This is what stops a cross-site POST in browsers that send neither header.
 */
export function isSameOriginPost(
  origin: string | null,
  secFetchSite: string | null,
  requestUrl: string,
  appUrl: string
): boolean {
  if (secFetchSite && secFetchSite !== 'same-origin') return false
  if (!origin || origin === 'null') return true
  const allowed = new Set<string>()
  for (const u of [requestUrl, appUrl]) {
    try {
      allowed.add(new URL(u).origin)
    } catch {
      // not a URL: ignore
    }
  }
  return allowed.has(origin)
}

export const CLAIM_START_TOKEN_SECONDS = 15 * 60

const UUID = /^[0-9a-f-]{36}$/

function claimSig(userId: string, siteId: string, exp: string, secret: string): string {
  return createHmac('sha256', secret).update(`claim-start.${userId}.${siteId}.${exp}`).digest('base64url')
}

/**
 * The form token /claim renders (15 minutes): `<siteId>.<expiresAtMs>.<hmac>`, the HMAC covering
 * the signed-in user AND the preview site the card was shown for (round 5), so a token can't be
 * reused by another user or for another link.
 */
export function claimStartToken(userId: string, siteId: string, now: number = Date.now()): string {
  const exp = String(now + CLAIM_START_TOKEN_SECONDS * 1000)
  return `${siteId}.${exp}.${claimSig(userId, siteId, exp, outreachCookieSecret('claim'))}`
}

/**
 * 'ok': authentic for this user and unexpired. 'expired' (Sable 1:45 AM): authentic for this user,
 * only too old, so /claim/start can show the card again with a fresh token. 'bad': anything else
 * (missing, malformed, forged, another user's token, or no secret configured): plain 403.
 */
export type ClaimTokenCheck = { status: 'ok' | 'expired'; siteId: string } | { status: 'bad' }

export function verifyClaimStartToken(token: unknown, userId: string, now: number = Date.now()): ClaimTokenCheck {
  const bad = { status: 'bad' } as const
  const secret = outreachCookieSecret('claim')
  if (!secret || typeof token !== 'string' || token.length > 200) return bad
  const parts = token.split('.')
  if (parts.length !== 3) return bad
  const [siteId, exp, sig] = parts
  if (!UUID.test(siteId) || !/^\d{1,15}$/.test(exp)) return bad
  const expected = Buffer.from(claimSig(userId, siteId, exp, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return bad
  return { status: Number(exp) > now ? 'ok' : 'expired', siteId }
}

/** Where an authentic but expired token goes: /claim shows the card again with Sable's 1:45 line. */
export const CLAIM_STALE_PATH = '/claim?claim=stale'

/**
 * /claim sends a signed-in user without a claimed site to /claim/start by submitting a small form.
 * It submits by itself only when the page was opened from this site or typed/bookmarked
 * (Sec-Fetch-Site same-origin or none), e.g. straight after sign-up or sign-in. Opened from
 * another site, the person taps "Claim my website" first.
 */
export function shouldAutoClaim(secFetchSite: string | null): boolean {
  return secFetchSite === 'same-origin' || secFetchSite === 'none'
}

/** /claim for a site that is already live goes to the dashboard (Vera r3 NEW-3). */
export function liveClaimRedirect(site: { publish_status?: string | null }): string | null {
  return site.publish_status === 'live' ? '/dashboard' : null
}
