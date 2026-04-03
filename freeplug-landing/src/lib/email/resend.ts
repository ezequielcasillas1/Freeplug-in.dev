import { Resend } from 'resend'

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

export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'Freeplug.dev <noreply@freeplug-in.dev>'
export const EMAIL_REPLY_TO = 'support@freeplug-in.dev'
