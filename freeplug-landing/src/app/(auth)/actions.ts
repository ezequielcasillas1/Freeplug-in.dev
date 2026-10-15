'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { SHARED_IP_BUCKET, clientIpFrom } from '@/lib/rate-limit/client-ip'
import { hashRateKey, rateCheck, rateDecision, type RateRule } from '@/lib/rate-limit'
import { adminAlertRecipients } from '@/lib/change-requests/alert'
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

/** Same message for sign-in and sign-up whether or not the email has an account. */
/**
 * Fixed auth messages (Oct 12): raw Supabase error text never reaches ?error=, and nothing says whether an
 * account exists. No i18n catalog yet. ES strings (Sable) go here when one exists:
 *   SIGN_IN_FAILED_MESSAGE      es: 'El correo o la contraseña no son correctos.'
 *   CHECK_INBOX_MESSAGE         es: 'Si ese correo se puede usar, te enviamos los siguientes pasos. Revisa tu bandeja de entrada.'
 *   GENERIC_ERROR_MESSAGE       es: 'Algo salió mal. Inténtalo de nuevo.'
 */
const SIGN_IN_FAILED_MESSAGE = 'Email or password is incorrect.'
const CHECK_INBOX_MESSAGE = "If that email can be used, we've sent next steps. Check your inbox."
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'
/** Weak/invalid password from Supabase on sign-up (gap 3). ES in comment below (Sable). */
// ES: "Esa contraseña no es lo bastante segura. Prueba con otra."
const WEAK_PASSWORD_MESSAGE = "That password isn't strong enough. Please try a different one."

/**
 * Supabase's password-strength rejection (AuthWeakPasswordError, code weak_password; older servers only
 * a 422 "Password should be ..." message). It says nothing about whether the account exists.
 */
function isWeakPasswordError(error: { code?: string; name?: string; message?: string }): boolean {
  return error.code === 'weak_password' || error.name === 'AuthWeakPasswordError' || /^password should/i.test(error.message ?? '')
}

const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Please try again later.'
/** Sign-up when the limiter database errors. ES (Sable, pending): 'Algo falló de nuestro lado. Inténtalo de nuevo en un minuto.' */
const LIMITER_DOWN_MESSAGE = 'Something went wrong on our end. Please try again in a minute.'

/**
 * Sign-in / sign-up limits on the shared DB-backed limiter (public.rate_check, the same one the password
 * reset uses). Sign-in counts FAILED attempts only, per email + client IP: after 5 failures inside 15
 * minutes the next attempt is blocked until the oldest failure leaves the 15-minute window. Sign-up: 5
 * attempts per client IP per hour. Without a trusted IP (clientIpFrom → the shared bucket) the IP part is
 * the shared bucket, so sign-up becomes 5/hour for everyone without one.
 *
 * The unknown-ip bucket: clientIpFrom only trusts CF-Connecting-IP when TRUST_CF_CONNECTING_IP=true
 * (production + preview Workers, wrangler.jsonc). Everywhere else (local dev, review ports) every
 * request shares SHARED_IP_BUCKET ('unknown-ip'), so a forged header can't buy a fresh bucket; the
 * cost is that those servers share one sign-up budget and sign-in is effectively per email.
 */
const AUTH_LIMITS = {
  signInFailures: { bucket: 'signin_fail_email_ip', limit: 5, windowSeconds: 900 } satisfies RateRule,
  /**
   * Cheke (Oct 12, 9:30 PM): no email-wide lock. Instead, 20 failed sign-ins per client IP per 15 minutes
   * (any emails) blocks that IP, so one address can't spray many accounts. A success does NOT clear it.
   */
  signInFailuresPerIp: { bucket: 'signin_fail_ip', limit: 20, windowSeconds: 900 } satisfies RateRule,
  signUpPerIp: { bucket: 'signup_ip', limit: 5, windowSeconds: 3600 } satisfies RateRule,
}

function signInKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip}`
}

type LockState = 'ok' | 'locked' | 'error'

/**
 * Read-only check (rate_check itself would record a hit). A database error returns 'error'; sign-in then
 * fails OPEN (Aria): allowed, logged, admins alerted.
 */
async function signInLockState(key: string, rule: RateRule = AUTH_LIMITS.signInFailures): Promise<LockState> {
  try {
    const since = new Date(Date.now() - rule.windowSeconds * 1000).toISOString()
    const { count, error } = await createAdminClient()
      .from('rate_limit_hits')
      .select('key_hash', { count: 'exact', head: true })
      .eq('bucket', rule.bucket)
      .eq('key_hash', hashRateKey(key))
      .gte('hit_at', since)
    if (error) {
      console.error('[signin-rate]', error.message)
      return 'error'
    }
    return (count ?? 0) >= rule.limit ? 'locked' : 'ok'
  } catch (e) {
    console.error('[signin-rate]', e instanceof Error ? e.message : e)
    return 'error'
  }
}

/** Successful sign-in: forget this email+IP's failures. Best effort (logged, never blocks the login). */
async function clearSignInFailures(key: string, rule: RateRule = AUTH_LIMITS.signInFailures): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from('rate_limit_hits')
      .delete()
      .eq('bucket', rule.bucket)
      .eq('key_hash', hashRateKey(key))
    if (error) console.error('[signin-rate] clear failed:', error.message)
  } catch (e) {
    console.error('[signin-rate] clear failed:', e instanceof Error ? e.message : e)
  }
}

const LIMITER_ALERT_INTERVAL_MS = 10 * 60 * 1000
let lastLimiterAlertAt = 0
let lastIpCapAlertAt = 0

/** Admin alert when an IP hits the 20-failures/15-min cap. Same path and throttle; no IP or email in the mail. */
function alertIpCapHit(): void {
  const now = Date.now()
  if (now - lastIpCapAlertAt < LIMITER_ALERT_INTERVAL_MS) return
  lastIpCapAlertAt = now
  const to = adminAlertRecipients()
  if (to.length === 0) {
    console.error('[signin-rate] ip-cap alert not sent: ADMIN_EMAILS is empty')
    return
  }
  void runAfterResponse('signin-ip-cap-alert', async () => {
    const res = await sendMail({
      to,
      subject: 'Sign-in: one IP hit the 20 failed attempts per 15 minutes cap',
      text: 'One client IP reached 20 failed sign-ins in 15 minutes (possibly trying many accounts) and is blocked from signing in until its failures age out of the 15-minute window.',
      replyTo: null,
      template: 'signin-ip-cap',
    })
    if (!res.success) console.error('[signin-rate] ip-cap alert not sent', res.reason)
  })
}

/**
 * Admin alert when the sign-in limiter database is down, through the existing admin alert path
 * (ADMIN_EMAILS + the app mailer, as src/lib/change-requests/alert.ts). At most once per 10 minutes per
 * process. No email, IP or error details in the mail.
 */
function alertLimiterDown(): void {
  const now = Date.now()
  if (now - lastLimiterAlertAt < LIMITER_ALERT_INTERVAL_MS) return
  lastLimiterAlertAt = now
  const to = adminAlertRecipients()
  if (to.length === 0) {
    console.error('[signin-rate] admin alert not sent: ADMIN_EMAILS is empty')
    return
  }
  void runAfterResponse('signin-rate-alert', async () => {
    const res = await sendMail({
      to,
      subject: 'Sign-in rate limiter unavailable (failing open)',
      text: 'The sign-in lockout check could not reach the rate limit database, so sign-ins are being allowed without the lockout. Check Supabase (public.rate_limit_hits / rate_check).',
      replyTo: null,
      template: 'signin-rate-limiter-down',
    })
    if (!res.success) console.error('[signin-rate] admin alert not sent', res.reason)
  })
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeNext(String(formData.get('next') ?? '/dashboard'))

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Email and password are required.'))
  }

  const ip = await clientIp()
  const rateKey = signInKey(email, ip)
  const ipKey = `ip|${ip}`
  const lock = await signInLockState(rateKey)
  const ipLock = lock === 'locked' ? 'ok' : await signInLockState(ipKey, AUTH_LIMITS.signInFailuresPerIp)
  if (ipLock === 'locked') alertIpCapHit()
  if (lock === 'locked' || ipLock === 'locked') {
    redirect('/login?error=' + encodeURIComponent(TOO_MANY_ATTEMPTS_MESSAGE))
  }
  if (lock === 'error' || ipLock === 'error') {
    console.error('[signin-rate] limiter database unavailable; allowing sign-in (fail open)')
    alertLimiterDown()
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // Record the failure (rate_check inserts a hit while under the limit).
    await rateCheck(AUTH_LIMITS.signInFailures, rateKey)
    await rateCheck(AUTH_LIMITS.signInFailuresPerIp, ipKey)
    redirect('/login?error=' + encodeURIComponent(SIGN_IN_FAILED_MESSAGE))
  }

  await clearSignInFailures(rateKey)
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

  // Only valid submissions count toward the 5/hour cap (Aria). A limiter DB error keeps blocking.
  const decision = await rateDecision(AUTH_LIMITS.signUpPerIp, await clientIp())
  if (decision === 'limited') {
    redirect(signupPath + 'error=' + encodeURIComponent(TOO_MANY_ATTEMPTS_MESSAGE))
  }
  if (decision === 'error') {
    redirect(signupPath + 'error=' + encodeURIComponent(LIMITER_DOWN_MESSAGE))
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

  // A weak/invalid password gets its own message (it can't reveal an account); every other error and
  // "confirm your email" answer identically, so the response never says whether the email has an account.
  if (error && isWeakPasswordError(error)) {
    redirect(signupPath + 'error=' + encodeURIComponent(WEAK_PASSWORD_MESSAGE))
  }
  if (error || (data.user && !data.session)) {
    if (error) console.error('[signup]', error.message)
    redirect(
      '/login?message=' +
        encodeURIComponent(CHECK_INBOX_MESSAGE) +
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
    console.error('[google-sign-in]', error.message)
    redirect('/login?error=' + encodeURIComponent(GENERIC_ERROR_MESSAGE))
  }

  if (data.url) {
    redirect(data.url)
  }
}

const UNKNOWN_IP_WARN_INTERVAL_MS = 60 * 1000
let lastUnknownIpWarnAt = 0

async function clientIp(): Promise<string> {
  const ip = clientIpFrom(await headers())
  // Production should always have a trusted CF-Connecting-IP; warn (at most once a minute per process)
  // when it falls into the shared bucket. Logs only the bucket name.
  if (ip === SHARED_IP_BUCKET && process.env.NODE_ENV === 'production') {
    const now = Date.now()
    if (now - lastUnknownIpWarnAt >= UNKNOWN_IP_WARN_INTERVAL_MS) {
      lastUnknownIpWarnAt = now
      console.warn('[rate-limit] production request in the unknown-ip bucket (TRUST_CF_CONNECTING_IP / CF-Connecting-IP missing)')
    }
  }
  return ip
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
    console.error('[update-password]', error.message)
    redirect('/reset-password?error=' + encodeURIComponent(GENERIC_ERROR_MESSAGE))
  }

  jar.delete(RESET_COOKIE_NAME)
  revalidatePath('/', 'layout')
  redirect('/dashboard?password_reset=1')
}
