import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { claimPreviewSiteForUser, currentPreviewSite } from '@/lib/outreach/server'
import { emailBaseUrl } from '@/lib/site'
import { CLAIM_STALE_PATH, claimRedirectPath, isSameOriginPost, verifyClaimStartToken } from './claim-redirect'

export const dynamic = 'force-dynamic'

const forbidden = () => new NextResponse('Forbidden', { status: 403, headers: { 'cache-control': 'private, no-store' } })

/**
 * Runs the claim for the signed-in user and the link in their preview cookie, then redirects to
 * /claim (Vera QA #1: the first /claim load after sign-up showed the "expired" 404 because the
 * page looked the site up again in the same render). Idempotent: an already-claimed user just
 * goes on to /claim. Only claims the link this browser opened, for the verified session user.
 *
 * POST only, from this site's own /claim page (Vera r2 bug 9): a GET gets 405 (Next answers
 * methods a route doesn't export); a cross-site POST, or one without the user's form token, gets
 * 403 and claims nothing. See isSameOriginPost.
 *
 * Round 5 (Sable 1:45 AM): a token that is genuine but past its 15 minutes, from a signed-in user
 * whose preview link is still valid and is the link the token was made for, goes back to /claim
 * with a fresh token and the "open for a while" line instead of a refusal. A token for another
 * user or another link, or a forged one, still gets the plain 403.
 * Round 6 (Jace's 3-case rule): a genuine expired token without a valid link goes to /claim, which
 * shows the saved claim's current step, or the neutral page when there is no claim.
 */
export async function POST(request: NextRequest) {
  const h = request.headers
  if (!isSameOriginPost(h.get('origin'), h.get('sec-fetch-site'), request.url, emailBaseUrl())) return forbidden()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const to = (path: string) => {
    // 303: the browser follows with a GET to /claim.
    const res = NextResponse.redirect(new URL(path, request.url), 303)
    res.headers.set('cache-control', 'private, no-store')
    return res
  }
  if (!user) return to('/signup?next=/claim')
  const form = await request.formData().catch(() => null)
  const token = verifyClaimStartToken(form?.get('t'), user.id)
  if (token.status === 'bad') return forbidden()
  const preview = await currentPreviewSite()
  // The token names the link its card was shown for; the browser's preview cookie must agree.
  if (preview && preview.id !== token.siteId) return forbidden()
  if (token.status === 'expired') return to(preview ? CLAIM_STALE_PATH : '/claim')
  return to(claimRedirectPath(await claimPreviewSiteForUser(user)))
}
