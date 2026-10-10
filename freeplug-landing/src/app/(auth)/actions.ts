'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { clientIpFrom } from '@/lib/rate-limit/client-ip'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appBaseUrl } from '@/lib/stripe/config'
import { safeNext } from '@/lib/auth/safe-next'
import { requestAwareBaseUrl } from '@/lib/site'
import { GOOGLE_DISABLED_MESSAGE, isGoogleSignInEnabled } from '@/lib/auth/google-enabled'
import { PASSWORD_MIN_LENGTH, isGoogleOnlyUser, recoveryConfirmUrl } from '@/lib/auth/password-reset'
import { isResetThrottled } from '@/lib/auth/reset-rate-limit'
import { runAfterResponse } from '@/lib/background'
import { createAnonClient } from '@/lib/supabase/anon'
import { syncLocaleCookieFromProfile } from '@/i18n/locale-cookie-sync'
import { isMailConfigured, sendMail } from '@/lib/email/mailer'
import { RESET_COOKIE_NAME, resetCookieSecret, verifyResetToken } from '@/lib/auth/reset-cookie'
import { sendPasswordResetEmail } from '@/lib/email/send'
import { GoogleSignInEmail } from '@/lib/email/templates/google-sign-in'
import {
  RESET_SEND_TIMEOUT_MS,
  recordResetFallback,
  resetFallbackReason,
  type ResetFallbackReason,
} from '@/lib/email/reset-fallback'

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeNext(String(formData.get('next') ?? '/dashboard'))

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Email and password are required.'))
  }

  const supabase = await createClient()
  const { data: signedIn, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }
  // The account's language (profiles.locale) wins over whatever the cookie said before sign-in.
  await syncLocaleCookieFromProfile(supabase, signedIn?.user?.id)

  revalidatePath('/', 'layout')
  redirect(next)
}

/** Optional `next` from a hidden field; null when absent so the default flow stays unchanged. */
function formNext(formData: FormData | undefined): string | null {
  const raw = formData?.get('next')
  if (typeof raw !== 'string' || !raw) return null
  const next = safeNext(raw)
  return next === raw ? next : null
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  const next = formNext(formData)
  const businessName = String(formData.get('business_name') ?? '').trim().slice(0, 200)
  const signupPath = next ? `/signup?next=${encodeURIComponent(next)}&` : '/signup?'

  if (!email || !password) {
    redirect(signupPath + 'error=' + encodeURIComponent('Email and password are required.'))
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    redirect(
      signupPath +
        'error=' +
        encodeURIComponent(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
    )
  }
  if (password !== confirm) {
    redirect(signupPath + 'error=' + encodeURIComponent('Passwords do not match.'))
  }

  const supabase = await createClient()
  const origin = appBaseUrl()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: next
        ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
        : `${origin}/auth/callback`,
      // freeplug_claim: the "Confirm signup" email template sends claim sign-ups back to /claim
      // ({{ if .Data.freeplug_claim }}, SUPABASE-AUTH-CHECKLIST.md); everyone else lands on /dashboard.
      ...(businessName || next === '/claim'
        ? {
            data: {
              ...(businessName ? { business_name: businessName } : {}),
              ...(next === '/claim' ? { freeplug_claim: true } : {}),
            },
          }
        : {}),
    },
  })

  if (error) {
    redirect(signupPath + 'error=' + encodeURIComponent(error.message))
  }

  if (data.user && !data.session) {
    redirect(
      '/login?message=' +
        encodeURIComponent('Check your email to confirm your account.') +
        (next ? `&next=${encodeURIComponent(next)}` : '')
    )
  }

  revalidatePath('/', 'layout')
  redirect(next ?? '/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signInWithGoogle(formData?: FormData) {
  const next = formNext(formData)
  if (!(await isGoogleSignInEnabled())) {
    redirect(
      '/login?error=' + encodeURIComponent(GOOGLE_DISABLED_MESSAGE) + (next ? `&next=${encodeURIComponent(next)}` : '')
    )
  }

  const supabase = await createClient()
  // The PKCE code-verifier cookie is set on the host the user is on; the callback must come back to
  // that same host or the code exchange can't find the verifier. requestAwareBaseUrl only follows the
  // Host header in `next dev` on localhost / 127.0.0.1; elsewhere it is NEXT_PUBLIC_APP_URL as before.
  const h = await headers()
  const origin = requestAwareBaseUrl(
    { host: h.get('host'), forwardedProto: h.get('x-forwarded-proto') },
    { fallback: appBaseUrl() }
  )

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: next ? `${origin}/auth/callback?next=${encodeURIComponent(next)}` : `${origin}/auth/callback`,
    },
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  if (data.url) {
    redirect(data.url)
  }
}

async function clientIp(): Promise<string> {
  return clientIpFrom(await headers())
}

/** Reset-link base: the local origin in `next dev` on localhost, else emailBaseUrl(). */
async function resetLinkBaseUrl(): Promise<string> {
  const h = await headers()
  return requestAwareBaseUrl({ host: h.get('host'), forwardedProto: h.get('x-forwarded-proto') })
}

/**
 * Sends the reset email from our own sender (Resend; EMAIL_FROM / EMAIL_FROM_NAME).
 * Unknown emails get nothing; Google-only accounts get a "sign in with Google" note.
 *
 * Runs AFTER the response (runAfterResponse → ctx.waitUntil on Workers), so it must not touch request-scoped
 * APIs: the caller passes `origin`, and the Supabase fallback uses a cookie-less anon client.
 *
 * Falls back to Supabase Auth's own mailer (resetPasswordForEmail: the hosted project's email settings)
 * ONLY when Resend clearly didn't accept the email: RESEND_API_KEY or the service role key missing, a
 * Resend 4xx/5xx, a network error with no response, no answer within RESET_SEND_TIMEOUT_MS (a late success
 * may then mean a duplicate, acceptable for a reset), or our template failing to render (logged at ERROR
 * with template + locale, counted separately). A returned id never falls back. Every fallback is logged
 * (never the address) and counted on the admin mail banner.
 */
async function deliverPasswordReset(email: string, origin: string): Promise<void> {
  const noKey = !isMailConfigured()
  const noServiceRole = !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const missing: ResetFallbackReason | null =
    noKey && noServiceRole ? 'missing_key+missing_service_role' : noKey ? 'missing_key' : noServiceRole ? 'missing_service_role' : null

  if (!missing) {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
    if (error || !data?.properties?.hashed_token) {
      // Most often "user not found": send nothing (the response already went out, identical either way).
      return
    }

    if (isGoogleOnlyUser(data.user)) {
      // No fallback here: a Supabase reset link would let a Google-only account set a password.
      const res = await sendMail({
        to: email,
        subject: 'How to sign in to Freeplug',
        react: GoogleSignInEmail({ baseUrl: origin }),
        template: 'google-sign-in',
      })
      if (!res.success) console.error('[password-reset] google-only notice not sent:', res.reason, res.status ?? '')
      return
    }

    const res = await sendPasswordResetEmail(
      email,
      { resetLink: recoveryConfirmUrl(origin, data.properties.hashed_token) },
      { timeoutMs: RESET_SEND_TIMEOUT_MS }
    )
    const fallback = resetFallbackReason(res)
    if (!fallback) return // Resend accepted it (an id came back).
    await recordResetFallback(fallback)
  } else {
    await recordResetFallback({ reason: missing, status: null })
  }

  const { error } = await createAnonClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })
  if (error) console.error('[password-reset] Supabase mailer error:', error.message)
}

/**
 * Forgot-password (Aria, round 5): validate, rate-limit (DB-backed, fails open to the in-memory limit for
 * the reset only), then answer immediately with the same neutral response in every case. The account lookup
 * and the send run after the response in ctx.waitUntil, so the response time doesn't depend on whether the
 * account exists. No sleeps or padding.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    redirect('/forgot-password?error=' + encodeURIComponent('Enter the email you use to sign in.'))
  }

  // Request-scoped values first (the background task can't read them).
  const ip = await clientIp()
  const origin = await resetLinkBaseUrl()

  let throttled = false
  try {
    throttled = await isResetThrottled(email, ip)
  } catch (e) {
    console.error('[password-reset] rate limit check failed:', e instanceof Error ? e.message : e)
  }
  if (!throttled) {
    void runAfterResponse('password-reset', () => deliverPasswordReset(email, origin))
  }

  // Same response whether or not the account exists (or the request was throttled).
  redirect('/forgot-password?sent=1')
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')

  if (password.length < PASSWORD_MIN_LENGTH) {
    redirect(
      '/reset-password?error=' +
        encodeURIComponent(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
    )
  }
  if (password !== confirm) {
    redirect('/reset-password?error=' + encodeURIComponent('Passwords do not match.'))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const jar = await cookies()
  // Only a session that came from a reset link (signed, 15-minute cookie for this user) may set a
  // new password here; a normal signed-in session is sent to request a link instead.
  if (!user || !verifyResetToken(jar.get(RESET_COOKIE_NAME)?.value, user.id, resetCookieSecret())) {
    redirect('/forgot-password?reason=reset-session')
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    redirect('/reset-password?error=' + encodeURIComponent(error.message))
  }

  jar.delete(RESET_COOKIE_NAME)
  revalidatePath('/', 'layout')
  redirect('/dashboard?password_reset=1')
}
