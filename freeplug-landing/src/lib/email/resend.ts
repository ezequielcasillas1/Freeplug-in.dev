import { Resend } from 'resend'

/**
 * The Resend client: the app's only email transport (Resend primary, Oct 3). Send through sendMail()
 * in ./mailer; this module only builds the client. RESEND_API_KEY is required for any app-sent email.
 */

let resend: Resend | null = null
let resendKey: string | null = null

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    throw new Error('RESEND_API_KEY is not set')
  }
  // Rebuilt if the key changes (a rotated secret on a warm isolate, or tests).
  if (!resend || resendKey !== key) {
    resend = new Resend(key)
    resendKey = key
  }
  return resend
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim()
}
