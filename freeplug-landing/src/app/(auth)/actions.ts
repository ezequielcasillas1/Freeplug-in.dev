'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { clientIpFrom, isTrustedClientIp } from '@/lib/rate-limit/client-ip'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { appBaseUrl } from '@/lib/stripe/config'
import { safeNext } from '@/lib/auth/safe-next'
import { requestAwareBaseUrl } from '@/lib/site'
import {
  PASSWORD_MIN_LENGTH,
  isGoogleOnlyUser,
  isResetThrottledForEmail,
  isResetThrottledForIp,
  recoveryConfirmUrl,
} from '@/lib/auth/password-reset'
import { isMailConfigured, sendMail } from '@/lib/email/mailer'
import { RESET_COOKIE_NAME, resetCookieSecret, verifyResetToken } from '@/lib/auth/reset-cookie'
import { sendPasswordResetEmail } from '@/lib/email/send'
import { GoogleSignInEmail } from '@/lib/email/templates/google-sign-in'

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = safeNext(String(formData.get('next') ?? '/dashboard'))

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Email and password are required.'))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

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
      ...(businessName ? { data: { business_name: businessName } } : {}),
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
  const supabase = await createClient()
  const origin = appBaseUrl()
  const next = formNext(formData)

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

/**
 * Sends the reset email from our own sender (Resend; EMAIL_FROM / EMAIL_FROM_NAME).
 * Unknown emails get nothing; Google-only accounts get a "sign in with Google" note.
 * Falls back to Supabase Auth's own mailer (the hosted project's email settings, not ours) only when
 * RESEND_API_KEY or the service role key is missing, or when our Resend send fails.
 */
/** Reset-link base: the local origin in `next dev` on localhost, else emailBaseUrl(). */
async function resetLinkBaseUrl(): Promise<string> {
  const h = await headers()
  return requestAwareBaseUrl({ host: h.get('host'), forwardedProto: h.get('x-forwarded-proto') })
}

async function deliverPasswordReset(email: string): Promise<void> {
  const origin = await resetLinkBaseUrl()

  if (isMailConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
    if (error || !data?.properties?.hashed_token) {
      // Most often "user not found": send nothing, the page still shows the neutral message.
      return
    }

    if (isGoogleOnlyUser(data.user)) {
      const res = await sendMail({
        to: email,
        subject: 'How to sign in to Freeplug',
        react: GoogleSignInEmail({ baseUrl: origin }),
      })
      if (!res.success) console.error('[password-reset] google-only notice failed:', res.error)
      return
    }

    const res = await sendPasswordResetEmail(email, {
      resetLink: recoveryConfirmUrl(origin, data.properties.hashed_token),
    })
    if (res.success) return
    console.error('[password-reset] Resend send failed, falling back to Supabase mailer:', res.error)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })
  if (error) console.error('[password-reset] Supabase mailer error:', error.message)
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    redirect('/forgot-password?error=' + encodeURIComponent('Enter the email you use to sign in.'))
  }

  const ip = await clientIp()
  const throttled =
    // No per-IP throttle on the shared bucket (everyone without a trusted IP), only per email (Vera r2 N6).
    (isTrustedClientIp(ip) && isResetThrottledForIp(ip)) || isResetThrottledForEmail(email)
  if (!throttled) {
    try {
      await deliverPasswordReset(email)
    } catch (e) {
      console.error('[password-reset]', e instanceof Error ? e.message : e)
    }
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
