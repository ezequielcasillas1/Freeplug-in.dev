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
export const DEFAULT_FROM_ADDRESS = 'no-reply@freeplug-in.dev'
/** Replies go to the real support mailbox on the root domain. */
export const DEFAULT_REPLY_TO = 'support@freeplug-in.dev'
const DEFAULT_FROM_NAME = 'Freeplug'
/** What a user sees when an email can't be sent (the specific reason goes to the server log only). */
export const MAIL_GENERIC_ERROR =
  "We couldn't send that email right now. Please try again in a few minutes. If it still doesn't work, email support@freeplug-in.dev."

export const MAIL_NOT_CONFIGURED = 'Email is not configured: RESEND_API_KEY is not set'

function env(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

/** True when the app can send email (RESEND_API_KEY is set). */
export function isMailConfigured(): boolean {
  return isResendConfigured()
}

/** RFC 5322 atext plus spaces: a display name made only of these needs no quotes. */
const PLAIN_DISPLAY_NAME = /^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~ ]+$/

/** Formatted From header, e.g. `Freeplug <no-reply@freeplug-in.dev>` (quoted only when the name needs it). */
export function getEmailFrom(): string {
  const address = env('EMAIL_FROM')
  if (!address) {
    const legacy = env('RESEND_FROM_EMAIL')
    if (legacy) return legacy
  }
  const addr = address ?? DEFAULT_FROM_ADDRESS
  const name = (env('EMAIL_FROM_NAME') ?? DEFAULT_FROM_NAME).replace(/["\\\r\n]/g, '').trim() || DEFAULT_FROM_NAME
  return PLAIN_DISPLAY_NAME.test(name) ? `${name} <${addr}>` : `"${name}" <${addr}>`
}

export function getDefaultReplyTo(): string {
  return env('EMAIL_REPLY_TO') ?? DEFAULT_REPLY_TO
}

/** User-facing text for a failed send: the detail outside production, a generic message in production. */
export function publicMailError(detail: string): string {
  return process.env.NODE_ENV === 'production' ? MAIL_GENERIC_ERROR : detail
}

/** From header, built from EMAIL_FROM_NAME + EMAIL_FROM (e.g. `Freeplug <no-reply@freeplug-in.dev>`). */
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
  /**
   * Give up waiting after this many ms (reason 'timeout'). Resend may still deliver it, so only use this
   * where a duplicate is acceptable (the password reset).
   */
  timeoutMs?: number
}

/**
 * Why a send failed. Resend did NOT accept the email in every case except possibly 'timeout' (the request
 * may have reached Resend):
 *   not_configured  RESEND_API_KEY missing, nothing attempted
 *   local_error     failed before any request (template render, no content)
 *   http            Resend answered with a 4xx/5xx (status; null if the error body had none)
 *   network         no response at all (DNS, connection reset, the SDK's "Unable to fetch data")
 *   timeout         no answer within timeoutMs
 */
export type MailFailureReason = 'not_configured' | 'local_error' | 'http' | 'network' | 'timeout'

export type MailResult =
  | { success: true; id: string }
  | { success: false; error: string; reason: MailFailureReason; status?: number | null }

const TIMED_OUT = Symbol('timeout')

async function withTimeout<T>(p: Promise<T>, ms: number | undefined): Promise<T | typeof TIMED_OUT> {
  if (!ms || ms <= 0) return p
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([p, new Promise<typeof TIMED_OUT>((r) => (timer = setTimeout(() => r(TIMED_OUT), ms)))])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Send one email through Resend. Never throws; never falls back to another transport. */
export async function sendMail(p: MailParams): Promise<MailResult> {
  let html = p.html
  let text = p.text
  try {
    if (p.react) {
      html = await render(p.react)
      if (!text) text = toPlainText(html)
    }
  } catch (err) {
    console.error(`[email] template render failed; not sent: "${p.subject}"`)
    return { success: false, reason: 'local_error', error: err instanceof Error ? err.message : 'Render failed' }
  }
  if (!html && !text) {
    return { success: false, reason: 'local_error', error: 'Email has no content' }
  }
  if (!isMailConfigured()) {
    // Fail closed: no other transport. Subject only (no recipient) in the log.
    console.error(`[email] ${MAIL_NOT_CONFIGURED}; not sent: "${p.subject}"`)
    return { success: false, reason: 'not_configured', error: MAIL_NOT_CONFIGURED }
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

  let outcome: Awaited<ReturnType<ReturnType<typeof getResend>['emails']['send']>> | typeof TIMED_OUT
  try {
    const request = p.idempotencyKey
      ? getResend().emails.send(payload, { idempotencyKey: p.idempotencyKey })
      : getResend().emails.send(payload)
    outcome = await withTimeout(request, p.timeoutMs)
  } catch (err) {
    // The SDK normally returns network failures as { error }, but a throw here also means no response.
    console.error(`[email] Resend request failed (network); not sent: "${p.subject}"`)
    return { success: false, reason: 'network', status: null, error: err instanceof Error ? err.message : 'Network error' }
  }
  if (outcome === TIMED_OUT) {
    console.error(`[email] Resend did not answer within ${p.timeoutMs} ms: "${p.subject}"`)
    return { success: false, reason: 'timeout', status: null, error: `Timed out after ${p.timeoutMs} ms` }
  }

  const { data, error } = outcome
  if (error) {
    // The resend SDK sets statusCode to the HTTP status for a 4xx/5xx and to null when no response came back.
    // The error message is NOT logged: it can echo the recipient address.
    const network = error.statusCode === null
    const status = typeof error.statusCode === 'number' ? error.statusCode : null
    console.error(
      network
        ? `[email] Resend network error (no response); not sent: "${p.subject}"`
        : `[email] Resend error ${status ?? '(no status)'} ${error.name ?? ''}; not sent: "${p.subject}"`
    )
    return network
      ? { success: false, reason: 'network', status: null, error: error.message }
      : { success: false, reason: 'http', status, error: error.message }
  }
  return { success: true, id: data?.id ?? '' }
}
