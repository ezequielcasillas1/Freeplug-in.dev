import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { appBaseUrl } from '@/lib/stripe/config'
import { confirmNext, confirmOtpType, type ConfirmOtpType } from '@/lib/auth/safe-next'
import { linkExpiredPath, type LinkExpiredFor } from '@/lib/auth/link-expired'
import { requestAwareBaseUrl } from '@/lib/site'
import {
  RESET_COOKIE_NAME,
  resetCookieOptions,
  resetCookieSecret,
  signResetToken,
} from '@/lib/auth/reset-cookie'

/**
 * Token-hash email links: our own password reset email, and every Supabase Auth template once it uses
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=<path>` (SUPABASE-AUTH-CHECKLIST.md).
 * Verifies the one-time token server-side, sets the session cookies, then continues to `next`. Works in
 * any browser, no PKCE verifier needed (so it also works for the cookieless reset fallback and
 * auth.resend, which sends no PKCE challenge).
 *
 * Round 6 (Aria): `type` must be on CONFIRM_OTP_TYPES and `next` on that type's allowlist (exact
 * paths; open-redirect variants fall back to the type's default). Any failure (expired or used token,
 * bad type, missing parameters) lands on the same neutral /link-expired page.
 */
function expiredFor(type: ConfirmOtpType | null, rawNext: string | null): LinkExpiredFor {
  if (type === 'recovery' || rawNext === '/reset-password') return 'reset'
  if (rawNext === '/claim') return 'claim'
  return 'account'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const rawNext = searchParams.get('next')
  const type = confirmOtpType(searchParams.get('type'))
  // Stay on the local dev server (localhost/127.0.0.1 in `next dev`) so the session cookies set
  // here are used; otherwise NEXT_PUBLIC_APP_URL as before.
  const origin = requestAwareBaseUrl(
    { host: request.headers.get('host'), forwardedProto: request.headers.get('x-forwarded-proto') },
    { fallback: appBaseUrl() }
  )

  if (tokenHash && type) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      const secret = resetCookieSecret()
      if (type === 'recovery' && data.user?.id && secret) {
        // Marks this browser session as "came from a reset link" for /reset-password (15 min).
        const jar = await cookies()
        jar.set(RESET_COOKIE_NAME, signResetToken(data.user.id, secret), resetCookieOptions())
      }
      return NextResponse.redirect(`${origin}${confirmNext(type, rawNext)}`)
    }
    // No error detail in the log (Supabase's message can name the link type; never the address).
    console.warn('[auth/confirm] link rejected:', type, error.code ?? error.status ?? 'error')
  }

  return NextResponse.redirect(`${origin}${linkExpiredPath(expiredFor(type, rawNext))}`)
}
