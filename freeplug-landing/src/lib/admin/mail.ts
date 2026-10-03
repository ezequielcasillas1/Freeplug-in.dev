import { isMailConfigured as isTransportConfigured, sendMail } from '@/lib/email/mailer'

/** True when the app can send email (RESEND_API_KEY is set). From is EMAIL_FROM / EMAIL_FROM_NAME. */
export function isMailConfigured(): boolean {
  return isTransportConfigured()
}

/** Free-form admin email to a customer (admin "Send email" box), sent through Resend. */
export async function sendAdminMail(params: {
  to: string
  subject: string
  text: string
  html?: string
  /** Optional Reply-To (e.g. a customer's address). Defaults to EMAIL_REPLY_TO. */
  replyTo?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await sendMail({
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    replyTo: params.replyTo,
  })
  return result.success ? { ok: true } : { ok: false, error: result.error }
}
