import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MailResult } from './mailer'

/**
 * Webhook email ledger (public.email_sends, migration 20261003160000_email_sends.sql).
 *
 * Every webhook-driven email goes through sendWebhookEmailOnce(), so a Stripe redelivery after Resend's
 * 24 h idempotency window, or two deliveries at once, can't send a second copy:
 *   1. claim  (email_send_claim): INSERT … ON CONFLICT (stripe_event_id, template) DO NOTHING RETURNING id;
 *      when nothing comes back, one conditional UPDATE re-claims a 'failed' row, or a 'pending' row older
 *      than 15 minutes (a crash after the claim), and bumps attempts. No row back = skip the send.
 *   2. send   (the caller's sender; it still passes the Resend idempotency key `<event.id>:<template>`).
 *   3. finish (email_send_finish): 'sent' + Resend id, or 'failed' + a short PII-free reason.
 *
 * Never throws. A claim error (DB down, missing service role) is logged and the email is NOT sent: a
 * missed notice is better than a duplicate, and the webhook still answers 2xx. No recipient, address
 * or Resend error text ever reaches the table or these logs.
 */
export type WebhookEmailOutcome = 'sent' | 'skipped' | 'claim_error' | 'send_failed'

export type LedgerClaim =
  | { kind: 'claimed'; id: string; attempts: number }
  | { kind: 'skip' }
  | { kind: 'error'; error: string }

const SAFE = /[^a-z0-9_ .:-]/gi

/** A short reason that can't carry personal data: the failure class and HTTP status only. */
export function ledgerErrorFor(result: Extract<MailResult, { success: false }>): string {
  const parts: string[] = [result.reason]
  if (result.status != null) parts.push(String(result.status))
  return parts.join(' ').replace(SAFE, '').slice(0, 200)
}

function short(e: unknown): string {
  const msg = e instanceof Error ? e.name : typeof e === 'object' && e && 'code' in e ? `db ${String((e as { code: unknown }).code)}` : 'error'
  return msg.replace(SAFE, '').slice(0, 80) || 'error'
}

export async function claimWebhookEmail(stripeEventId: string, template: string): Promise<LedgerClaim> {
  try {
    const { data, error } = await createAdminClient().rpc('email_send_claim', {
      p_stripe_event_id: stripeEventId,
      p_template: template,
    })
    if (error) return { kind: 'error', error: short(error) }
    const row = Array.isArray(data) ? (data[0] as { id?: string; attempts?: number } | undefined) : undefined
    if (!row?.id) return { kind: 'skip' }
    return { kind: 'claimed', id: row.id, attempts: row.attempts ?? 1 }
  } catch (e) {
    return { kind: 'error', error: short(e) }
  }
}

export async function finishWebhookEmail(
  id: string,
  outcome: { status: 'sent'; resendId: string } | { status: 'failed'; error: string }
): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc('email_send_finish', {
      p_id: id,
      p_status: outcome.status,
      p_resend_id: outcome.status === 'sent' ? outcome.resendId : null,
      p_error: outcome.status === 'failed' ? outcome.error.replace(SAFE, '').slice(0, 200) : null,
    })
    if (error) {
      console.error('[email-ledger] could not record the outcome', outcome.status, short(error))
      return false
    }
    return data === true
  } catch (e) {
    console.error('[email-ledger] could not record the outcome', outcome.status, short(e))
    return false
  }
}

/**
 * Claims (stripeEventId, template), runs `send` only when the claim succeeded, and records the outcome.
 * `label` is for logs (e.g. the subscription id); never pass an email address.
 */
export async function sendWebhookEmailOnce(
  stripeEventId: string,
  template: string,
  label: string,
  send: () => Promise<MailResult>
): Promise<WebhookEmailOutcome> {
  const claim = await claimWebhookEmail(stripeEventId, template)
  if (claim.kind === 'error') {
    console.error(`[email-ledger] claim failed; not sending: event=${stripeEventId} template=${template} ${label} (${claim.error})`)
    return 'claim_error'
  }
  if (claim.kind === 'skip') {
    console.info(`[email-ledger] already sent or in progress; skipping: event=${stripeEventId} template=${template} ${label}`)
    return 'skipped'
  }

  let result: MailResult
  try {
    result = await send()
  } catch (e) {
    result = { success: false, reason: 'local_error', error: e instanceof Error ? e.message : 'Unknown error' }
  }
  if (result.success) {
    await finishWebhookEmail(claim.id, { status: 'sent', resendId: result.id })
    return 'sent'
  }
  const reason = ledgerErrorFor(result)
  await finishWebhookEmail(claim.id, { status: 'failed', error: reason })
  console.error(`[email-ledger] send failed: event=${stripeEventId} template=${template} ${label} attempt=${claim.attempts} (${reason})`)
  return 'send_failed'
}
