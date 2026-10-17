/**
 * Public contact form (/contact): validation + recipient. Nothing is stored; each submission is emailed.
 * Env: CONTACT_FORM_TO (recipient; default iqc@freeplug-in.dev). Sending reuses the Resend mailer
 * (RESEND_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME); spam check reuses Turnstile (TURNSTILE_SECRET_KEY,
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY), which fails closed in production when unset.
 */
export const DEFAULT_CONTACT_TO = 'iqc@freeplug-in.dev'

export const CONTACT_LIMITS = { name: 100, email: 254, message: 5000, messageMin: 10 } as const

export const CONTACT_SUCCESS = "Thanks for reaching out. We got your message and will reply by email soon."
export const CONTACT_ERROR =
  "Sorry, we couldn't send your message right now. Please try again in a few minutes, or email iqc@freeplug-in.dev."

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/

export function contactRecipient(): string {
  return process.env.CONTACT_FORM_TO?.trim() || DEFAULT_CONTACT_TO
}

export type ContactInput = { name: string; email: string; message: string }

export type ContactValidation =
  | { ok: true; value: ContactInput }
  | { ok: false; error: string }
  | { ok: 'honeypot' }

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function validateContact(input: unknown): ContactValidation {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  // Honeypot: real visitors never see or fill "website".
  if (str(o.website).trim()) return { ok: 'honeypot' }
  const name = str(o.name).replace(/[\r\n]+/g, ' ').trim()
  const email = str(o.email).trim()
  const message = str(o.message).trim()
  if (!name) return { ok: false, error: 'Please enter your name.' }
  if (name.length > CONTACT_LIMITS.name) return { ok: false, error: `Name must be ${CONTACT_LIMITS.name} characters or less.` }
  if (!email || email.length > CONTACT_LIMITS.email || !EMAIL_RE.test(email))
    return { ok: false, error: 'Please enter a valid email address.' }
  if (message.length < CONTACT_LIMITS.messageMin)
    return { ok: false, error: `Please write at least ${CONTACT_LIMITS.messageMin} characters.` }
  if (message.length > CONTACT_LIMITS.message)
    return { ok: false, error: `Message must be ${CONTACT_LIMITS.message} characters or less.` }
  return { ok: true, value: { name, email, message } }
}
