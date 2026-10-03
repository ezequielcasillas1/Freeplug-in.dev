import type { ReactElement } from 'react'
import { render, toPlainText } from '@react-email/components'
import { getResend, isResendConfigured } from './resend'

/**
 * Outbound mail for every email the app sends itself (Resend primary, Oct 3, Jace). nodemailer/SMTP is
 * removed: there is NO SMTP fallback. Supabase Auth sends its own emails (sign-up confirmation, the
 * claim "send it again", the fallback password reset) through the hosted project's mail settings.
 *
 * Env:
 *   RESEND_API_KEY (required; a Worker SECRET only: `wrangler versions secret put RESEND_API_KEY`, never
 *     wrangler "vars"; a sending-only key scoped to the sending domain)
 *   EMAIL_FROM (address on the Resend-verified domain freeplug-in.dev; default DEFAULT_FROM_ADDRESS)
 *   EMAIL_FROM_NAME (display name; default Freeplug)
 *   EMAIL_REPLY_TO (default Reply-To; default support@freeplug-in.dev)
 *   RESEND_FROM_EMAIL (legacy full "Name <addr>" header; used only when EMAIL_FROM is unset)
 * Fails closed: without RESEND_API_KEY every send returns { success: false, error: MAIL_NOT_CONFIGURED },
 * logs a clear error, and sends nothing. Show users publicMailError(), not the raw error.
 */

/**
 * From is on the main domain freeplug-in.dev (Aria/Rio, Oct 3). send.freeplug-in.dev is only Resend's
 * return path (MX + SPF live there); it never appears in From.
 */
export const DEFAULT_FROM_ADDRESS = 'support@freeplug-in.dev'
/** Replies go to the real support mailbox on the root domain. */
export const DEFAULT_REPLY_TO = 'support@freeplug-in.dev'
const DEFAULT_FROM_NAME = 'Freeplug'
/** What a user sees when an email can't be sent (the specific reason goes to the server log only). */
export const MAIL_GENERIC_ERROR = 'We couldn\'t send that email right now. Please try again later.'

export const MAIL_NOT_CONFIGURED = 'Email is not configured: RESEND_API_KEY is not set'

function env(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

/** True when the app can send email (RESEND_API_KEY is set). */
export function isMailConfigured(): boolean {
  return isResendConfigured()
}

/** Formatted From header, e.g. `"Freeplug" <support@freeplug-in.dev>`. */
export function getEmailFrom(): string {
  const address = env('EMAIL_FROM')
  if (!address) {
    const legacy = env('RESEND_FROM_EMAIL')
    if (legacy) return legacy
  }
  const addr = address ?? DEFAULT_FROM_ADDRESS
  const name = (env('EMAIL_FROM_NAME') ?? DEFAULT_FROM_NAME).replace(/"/g, '')
  return `"${name}" <${addr}>`
}

export function getDefaultReplyTo(): string {
  return env('EMAIL_REPLY_TO') ?? DEFAULT_REPLY_TO
}

/** User-facing text for a failed send: the detail outside production, a generic message in production. */
export function publicMailError(detail: string): string {
  return process.env.NODE_ENV === 'production' ? MAIL_GENERIC_ERROR : detail
}

/** From header, built from EMAIL_FROM_NAME + EMAIL_FROM (e.g. `"Freeplug" <support@freeplug-in.dev>`). */
export const EMAIL_FROM = getEmailFrom()
/** Default Reply-To (EMAIL_REPLY_TO or support@freeplug-in.dev). */
export const EMAIL_REPLY_TO = getDefaultReplyTo()

export type MailParams = {
  to: string | string[]
  subject: string
  /** React Email component; rendered to HTML + plain text. */
  react?: ReactElement
  html?: string
  text?: string
  /** Reply-To header. Pass the customer's address for form submissions. Defaults to EMAIL_REPLY_TO. `null` omits it. */
  replyTo?: string | string[] | null
  /** Override the From header (defaults to getEmailFrom()). */
  from?: string
  cc?: string | string[]
  bcc?: string | string[]
  /** Resend Idempotency-Key (e.g. `<stripe event.id>:<template>` for webhook sends); repeats within 24h send once. */
  idempotencyKey?: string
}

export type MailResult = { success: true; id: string } | { success: false; error: string }

/** Send one email through Resend. Never throws; never falls back to another transport. */
export async function sendMail(p: MailParams): Promise<MailResult> {
  try {
    let html = p.html
    let text = p.text
    if (p.react) {
      html = await render(p.react)
      if (!text) text = toPlainText(html)
    }
    if (!html && !text) {
      return { success: false, error: 'Email has no content' }
    }
    if (!isMailConfigured()) {
      // Fail closed: no other transport. Subject only (no recipient) in the log.
      console.error(`[email] ${MAIL_NOT_CONFIGURED}; not sent: "${p.subject}"`)
      return { success: false, error: MAIL_NOT_CONFIGURED }
    }

    const replyTo = p.replyTo === null ? undefined : (p.replyTo ?? getDefaultReplyTo())
    const base = {
      from: p.from ?? getEmailFrom(),
      to: p.to,
      subject: p.subject,
      ...(replyTo ? { replyTo } : {}),
      ...(p.cc ? { cc: p.cc } : {}),
      ...(p.bcc ? { bcc: p.bcc } : {}),
    }
    const payload = html ? { ...base, html, ...(text ? { text } : {}) } : { ...base, text: text! }
    const { data, error } = p.idempotencyKey
      ? await getResend().emails.send(payload, { idempotencyKey: p.idempotencyKey })
      : await getResend().emails.send(payload)
    if (error) {
      console.error(`[email] Resend error; not sent: "${p.subject}":`, error.message)
      return { success: false, error: error.message }
    }
    return { success: true, id: data?.id ?? '' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
