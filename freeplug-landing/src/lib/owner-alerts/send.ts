import { sendMail as realSendMail, type MailParams, type MailResult } from '@/lib/email/mailer'
import { sendWebhookEmailOnce as realOnce, type WebhookEmailOutcome } from '@/lib/email/webhook-email-ledger'
import { runAfterResponse } from '@/lib/background'
import { appBaseUrl } from '@/lib/stripe/config'
import { renderOwnerAlert, type OwnerAlert } from './format'

/** Owner alert recipient: OWNER_ALERT_EMAIL (non-secret Worker var). Unset or invalid = no alerts. */
export function ownerAlertRecipient(): string | null {
  const v = (process.env.OWNER_ALERT_EMAIL ?? '').trim()
  return /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v) ? v : null
}

export type OwnerAlertDeps = {
  sendMail: (p: MailParams) => Promise<MailResult>
  sendWebhookEmailOnce: (eventId: string, template: string, label: string, send: () => Promise<MailResult>) => Promise<WebhookEmailOutcome>
}
const realDeps: OwnerAlertDeps = { sendMail: realSendMail, sendWebhookEmailOnce: realOnce }

export type OwnerAlertOutcome = 'disabled' | 'sent' | 'skipped' | 'failed'

/**
 * Send one owner alert. Never throws. Dedupe: `dedupeKey` (row id, user id or Stripe event id) is the
 * Resend idempotency key; webhook alerts also go through the email_sends ledger keyed on the Stripe
 * event id (template 'owner-alert'), so a Stripe retry never sends a second copy.
 */
export async function sendOwnerAlert(
  alert: OwnerAlert,
  opts: { dedupeKey: string; stripeEventId?: string },
  deps: OwnerAlertDeps = realDeps
): Promise<OwnerAlertOutcome> {
  try {
    const to = ownerAlertRecipient()
    if (!to) return 'disabled'
    const { subject, html, text } = renderOwnerAlert(alert, appBaseUrl())
    const send = () =>
      deps.sendMail({ to, subject, html, text, replyTo: null, idempotencyKey: `owner-alert:${opts.dedupeKey}`.slice(0, 256), template: 'owner-alert' })
    if (opts.stripeEventId) {
      const o = await deps.sendWebhookEmailOnce(opts.stripeEventId, 'owner-alert', alert.kind, send)
      return o === 'sent' ? 'sent' : o === 'skipped' ? 'skipped' : 'failed'
    }
    const r = await send()
    if (!r.success) console.error('[owner-alert] not sent', alert.kind, r.reason)
    return r.success ? 'sent' : 'failed'
  } catch (e) {
    console.error('[owner-alert] failed', alert.kind, e instanceof Error ? e.message : e)
    return 'failed'
  }
}

/**
 * Fire-and-forget after the main write: the user's action never waits for or fails on an alert.
 * `build` runs after the response (no headers()/cookies() inside); null = nothing to send.
 */
export function scheduleOwnerAlert(
  label: string,
  build: () => Promise<{ alert: OwnerAlert; dedupeKey: string; stripeEventId?: string } | null>
): void {
  if (!ownerAlertRecipient()) return
  try {
    void runAfterResponse(`owner-alert:${label}`, async () => {
      const job = await build()
      if (job) await sendOwnerAlert(job.alert, { dedupeKey: job.dedupeKey, stripeEventId: job.stripeEventId })
    })
  } catch (e) {
    console.error('[owner-alert] schedule failed', label, e instanceof Error ? e.message : e)
  }
}
