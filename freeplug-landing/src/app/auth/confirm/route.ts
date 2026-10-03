import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { appBaseUrl } from '@/lib/stripe/config'
import { safeNext } from '@/lib/auth/safe-next'
import { requestAwareBaseUrl } from '@/lib/site'
import {
  RESET_COOKIE_NAME,
  resetCookieOptions,
  resetCookieSecret,
  signResetToken,
} from '@/lib/auth/reset-cookie'

const OTP_TYPES: EmailOtpType[] = ['recovery', 'signup', 'invite', 'magiclink', 'email_change', 'email']

/**
 * Token-hash email links (used by our own password reset email). Verifies the one-time token,
 * sets the session cookies, then continues to `next`. Works in any browser, no PKCE verifier needed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const rawType = searchParams.get('type')
  const type = OTP_TYPES.find((t) => t === rawType)
  const next = safeNext(searchParams.get('next') ?? '/dashboard')
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
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  if (type === 'recovery' || next === '/reset-password') {
    return NextResponse.redirect(`${origin}/reset-password?expired=1`)
  }
  return NextResponse.redirect(`${origin}/login?error=Could+not+authenticate`)
}
