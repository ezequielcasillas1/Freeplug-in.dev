import { NextResponse } from 'next/server'
import { enterPreviewWithToken } from '@/lib/outreach/server'
import { PREVIEW_RESPONSE_HEADERS } from '@/lib/outreach/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Private preview link (/p/<token>). Checks the token (exact SHA-256 lookup, rate limited per IP),
 * swaps it for a signed httpOnly cookie and redirects to /preview, so the token never stays in the
 * address bar, history or referrers. Valid and invalid tokens get the same 303 to /preview; an
 * invalid one clears the cookie, so /preview shows the same expired-link 404 for every bad state.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  await enterPreviewWithToken(token)
  const res = NextResponse.redirect(new URL('/preview', request.url), 303)
  for (const [k, v] of Object.entries(PREVIEW_RESPONSE_HEADERS)) res.headers.set(k, v)
  return res
}
