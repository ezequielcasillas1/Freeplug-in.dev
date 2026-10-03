import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type { ReactElement } from 'react'
import { render, toPlainText } from '@react-email/components'

/**
 * Primary outbound mail transport: SMTP (Namecheap Private Email by default).
 *
 * Env:
 *   SMTP_HOST, SMTP_PORT (465), SMTP_SECURE (true for 465), SMTP_USER, SMTP_PASS
 *   EMAIL_FROM (address, defaults to SMTP_USER), EMAIL_FROM_NAME (display name)
 *   EMAIL_REPLY_TO (optional default Reply-To, defaults to support@freeplug-in.dev)
 *   SMTP_FROM (legacy full "Name <addr>" header; used only when EMAIL_FROM is unset)
 *   SMTP_TLS_REJECT_UNAUTHORIZED=false (local debugging only)
 */

const DEFAULT_FROM_ADDRESS = 'support@freeplug-in.dev'
const DEFAULT_FROM_NAME = 'Freeplug'

function env(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

export function isSmtpConfigured(): boolean {
  return Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS'))
}

/** Formatted From header, e.g. `"Freeplug" <support@freeplug-in.dev>`. */
export function getEmailFrom(): string {
  const address = env('EMAIL_FROM')
  if (!address) {
    const legacy = env('SMTP_FROM') ?? env('RESEND_FROM_EMAIL')
    if (legacy) return legacy
  }
  const addr = address ?? env('SMTP_USER') ?? DEFAULT_FROM_ADDRESS
  const name = (env('EMAIL_FROM_NAME') ?? DEFAULT_FROM_NAME).replace(/"/g, '')
  return `"${name}" <${addr}>`
}

export function getDefaultReplyTo(): string {
  return env('EMAIL_REPLY_TO') ?? DEFAULT_FROM_ADDRESS
}

/** Default true. Set SMTP_TLS_REJECT_UNAUTHORIZED=false only when TLS fails with "self-signed certificate in certificate chain" (often local AV/proxy SSL inspection). Do not use in production unless you understand the risk. */
function tlsRejectUnauthorized(): boolean {
  const v = env('SMTP_TLS_REJECT_UNAUTHORIZED')?.toLowerCase()
  return !(v === 'false' || v === '0')
}

let transporter: Transporter | null = null

export function getSmtpTransport(): Transporter {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)')
  }
  if (!transporter) {
    const host = env('SMTP_HOST')!
    const port = Number(env('SMTP_PORT') ?? '465') || 465
    const secureEnv = env('SMTP_SECURE')?.toLowerCase()
    const secure =
      secureEnv === 'true' || secureEnv === '1'
        ? true
        : secureEnv === 'false' || secureEnv === '0'
          ? false
          : port === 465
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: env('SMTP_USER')!, pass: env('SMTP_PASS')! },
      tls: { rejectUnauthorized: tlsRejectUnauthorized(), servername: host },
    })
  }
  return transporter
}

export function withSmtpAuthHint(msg: string): string {
  if (/535|authentication failed|invalid login/i.test(msg)) {
    return `${msg} — Verify SMTP_USER is the full mailbox address, SMTP_PASS matches Private Email webmail (no quotes/spaces in .env), and SMTP is enabled for that mailbox in Namecheap. Reset the mailbox password if unsure.`
  }
  return msg
}

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
}

export type MailResult = { success: true; id: string } | { success: false; error: string }

async function sendViaResendFallback(p: MailParams, html?: string, text?: string): Promise<MailResult> {
  const { Resend } = await import('resend')
  const resend = new Resend(env('RESEND_API_KEY')!)
  const replyTo = p.replyTo === null ? undefined : (p.replyTo ?? getDefaultReplyTo())
  const { data, error } = await resend.emails.send({
    from: p.from ?? getEmailFrom(),
    to: p.to,
    subject: p.subject,
    ...(replyTo ? { replyTo } : {}),
    ...(p.cc ? { cc: p.cc } : {}),
    ...(p.bcc ? { bcc: p.bcc } : {}),
    html: html ?? (text ? `<pre>${text.replace(/</g, '&lt;')}</pre>` : ''),
    ...(text ? { text } : {}),
  })
  if (error) return { success: false, error: error.message }
  return { success: true, id: data?.id ?? '' }
}

/**
 * Send one email. SMTP is primary; Resend is used only as an optional fallback
 * when SMTP is not configured but RESEND_API_KEY is set.
 */
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

    if (!isSmtpConfigured()) {
      if (env('RESEND_API_KEY')) return await sendViaResendFallback(p, html, text)
      return { success: false, error: 'SMTP is not configured' }
    }

    const replyTo = p.replyTo === null ? undefined : (p.replyTo ?? getDefaultReplyTo())
    const info = await getSmtpTransport().sendMail({
      from: p.from ?? getEmailFrom(),
      to: p.to,
      subject: p.subject,
      ...(replyTo ? { replyTo } : {}),
      ...(p.cc ? { cc: p.cc } : {}),
      ...(p.bcc ? { bcc: p.bcc } : {}),
      ...(html ? { html } : {}),
      ...(text ? { text } : {}),
    })
    return { success: true, id: info.messageId ?? '' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: withSmtpAuthHint(msg) }
  }
}
