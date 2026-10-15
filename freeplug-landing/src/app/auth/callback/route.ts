import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { appBaseUrl } from '@/lib/stripe/config'
import { safeNext } from '@/lib/auth/safe-next'
import { requestAwareBaseUrl } from '@/lib/site'
import {
  RESET_COOKIE_NAME,
  isRecoveryAccessToken,
  resetCookieOptions,
  resetCookieSecret,
  signResetToken,
} from '@/lib/auth/reset-cookie'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next') ?? '/dashboard')
  // Stay on the local dev server (localhost/127.0.0.1 in `next dev`) so the session cookies set
  // here are used; otherwise NEXT_PUBLIC_APP_URL as before.
  const origin = requestAwareBaseUrl(
    { host: request.headers.get('host'), forwardedProto: request.headers.get('x-forwarded-proto') },
    { fallback: appBaseUrl() }
  )

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Supabase-mailer fallback: only a session that really came from a recovery link
      // (amr method "recovery") gets the /reset-password marker cookie.
      const secret = resetCookieSecret()
      if (
        next === '/reset-password' &&
        secret &&
        data.user?.id &&
        isRecoveryAccessToken(data.session?.access_token)
      ) {
        const jar = await cookies()
        jar.set(RESET_COOKIE_NAME, signResetToken(data.user.id, secret), resetCookieOptions())
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // A used or expired password-reset link should explain itself, not bounce to login.
  if (next === '/reset-password') {
    return NextResponse.redirect(`${origin}/reset-password?expired=1`)
  }
  return NextResponse.redirect(`${origin}/login?error=Could+not+authenticate`)
}
