import { isSmtpConfigured as isSmtpTransportConfigured, sendMail } from '@/lib/email/smtp'

/** True when SMTP_HOST, SMTP_USER and SMTP_PASS are set (From defaults to EMAIL_FROM / SMTP_USER). */
export function isSmtpConfigured(): boolean {
  return isSmtpTransportConfigured()
}

export async function sendSmtpMail(params: {
  to: string
  subject: string
  text: string
  html?: string
  /** Optional Reply-To (e.g. a customer's address). Defaults to EMAIL_REPLY_TO. */
  replyTo?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: 'SMTP is not configured' }
  }
  const result = await sendMail({
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    replyTo: params.replyTo,
  })
  return result.success ? { ok: true } : { ok: false, error: result.error }
}
