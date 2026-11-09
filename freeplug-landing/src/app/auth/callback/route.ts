import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { appBaseUrl } from '@/lib/stripe/config'
import { safeNext } from '@/lib/auth/safe-next'
import { syncLocaleCookieFromProfile } from '@/i18n/locale-cookie-sync'
import { alertOwner } from '@/lib/owner-alerts/events'
import { requestAwareBaseUrl } from '@/lib/site'
import { AUTH_MAINTENANCE, SIGNUPS_PAUSED, signupPausedLoginPath } from '@/lib/auth/signups-paused'
import { isAdminEmail } from '@/lib/auth/admin-login'
import { shouldBlockSignIn } from '@/lib/auth/oauth-new-user'
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
      // Sign-ups paused: a Google account created by this sign-in is signed out (nothing deleted).
      // Auth maintenance (Oct 24): only ADMIN_EMAILS get a session; everyone else is signed out
      // (Google, email links, recovery links alike). No owner alert for blocked attempts.
      if (AUTH_MAINTENANCE && !isAdminEmail(data.user?.email)) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login`)
      }
      // Any account created on/after the cutoff, or with no profiles row, is signed out; no owner alert.
      if (SIGNUPS_PAUSED && data.user) {
        const { data: prof, error: profError } = await supabase.from('profiles').select('id').eq('id', data.user.id).maybeSingle()
        const hasProfile = profError ? null : Boolean(prof)
        if (!isAdminEmail(data.user.email) && shouldBlockSignIn(data.user, hasProfile)) {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}${signupPausedLoginPath('en')}`)
        }
      }
      // Google / email-link sign-in: cookie follows profiles.locale.
      await syncLocaleCookieFromProfile(supabase, data.user?.id)
      // Owner alert: a Google account created just now (email sign-ups alert from signUp; same dedupe key).
      const u = data.user
      if (u && u.app_metadata?.provider === 'google' && Date.now() - Date.parse(u.created_at) < 10 * 60_000) {
        alertOwner({ kind: 'signup', dedupeKey: `signup:${u.id}`, userId: u.id, email: u.email ?? null, details: [['Signed up with', 'Google']] })
      }
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
