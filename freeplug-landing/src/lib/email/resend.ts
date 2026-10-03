import { Resend } from 'resend'
import { getEmailFrom, getDefaultReplyTo } from './smtp'

/**
 * Resend is now an OPTIONAL fallback only. Primary sending is SMTP (see ./smtp.ts).
 * RESEND_API_KEY is not required; it is only used when SMTP is not configured.
 */

let resend: Resend | null = null

export function getResend(): Resend {
  if (!resend) {
    const key = process.env.RESEND_API_KEY?.trim()
    if (!key) {
      throw new Error('RESEND_API_KEY is not set')
    }
    resend = new Resend(key)
  }
  return resend
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim()
}

/** From header, built from EMAIL_FROM_NAME + EMAIL_FROM (e.g. `"Freeplug" <support@freeplug-in.dev>`). */
export const EMAIL_FROM = getEmailFrom()
/** Default Reply-To (EMAIL_REPLY_TO or support@freeplug-in.dev). */
export const EMAIL_REPLY_TO = getDefaultReplyTo()
