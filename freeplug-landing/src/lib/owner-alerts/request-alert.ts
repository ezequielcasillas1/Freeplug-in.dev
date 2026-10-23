import { sendMail as realSendMail, type MailParams, type MailResult } from '@/lib/email/mailer'
import { runAfterResponse } from '@/lib/background'
import { chicagoTime } from './format'

/**
 * Request alert (Ezequiel, Oct 22 2026): every new website request also emails 72After Consulting.
 * Separate from the owner alert (OWNER_ALERT_EMAIL), which is unchanged. Same mail path (sendMail /
 * Resend), runs after the response, never throws into the action, deduped by a Resend idempotency key.
 */
export const DEFAULT_REQUEST_ALERT_EMAIL = 'fplgn.dev.clients@gmail.com'

/** REQUEST_ALERT_EMAIL (non-secret Worker var); unset = default; "off" or invalid = no request alerts. */
export function requestAlertRecipient(): string | null {
  const raw = process.env.REQUEST_ALERT_EMAIL
  const v = (raw === undefined || raw.trim() === '' ? DEFAULT_REQUEST_ALERT_EMAIL : raw).trim()
  return /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(v) ? v : null
}

export type RequestAlert = {
  kind: 'website_request' | 'maintenance_quote_request'
  name?: string | null
  email?: string | null
  phone?: string | null
  business?: string | null
  /** The request fields, in order. */
  details: ReadonlyArray<readonly [string, string | null | undefined]>
  at?: Date
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
const clean = (s: string | null | undefined, max = 300) => (s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max)
const LABEL = { website_request: 'New website request', maintenance_quote_request: 'New maintenance quote request' } as const

export function renderRequestAlert(a: RequestAlert): { subject: string; html: string; text: string } {
  const who = clean(a.name, 80) || clean(a.email, 120) || 'unknown'
  const biz = clean(a.business, 120)
  const subject = `${LABEL[a.kind]}: ${who}${biz ? ` (${biz})` : ''}`.slice(0, 200)
  const rows: Array<[string, string]> = []
  if (clean(a.name)) rows.push(['Name', clean(a.name)])
  if (clean(a.email)) rows.push(['Email', clean(a.email)])
  if (clean(a.phone)) rows.push(['Phone', clean(a.phone)])
  if (biz) rows.push(['Business', clean(a.business)])
  for (const [k, v] of a.details) if (clean(v, 5000)) rows.push([clean(k, 60), clean(v, 5000)])
  rows.push(['Time', chicagoTime(a.at ?? new Date())])
  const text = [LABEL[a.kind], '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n')
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:24px">
<h1 style="margin:0 0 16px;font-size:18px">${esc(LABEL[a.kind])}</h1>
<table style="border-collapse:collapse;width:100%;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#71717a;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join('')}</table>
</div></body></html>`
  return { subject, html, text }
}

export type RequestAlertOutcome = 'disabled' | 'sent' | 'failed'

/** Send one request alert. Never throws. `dedupeKey` becomes the Resend idempotency key. */
export async function sendRequestAlert(
  alert: RequestAlert,
  dedupeKey: string,
  sendMail: (p: MailParams) => Promise<MailResult> = realSendMail
): Promise<RequestAlertOutcome> {
  try {
    const to = requestAlertRecipient()
    if (!to) return 'disabled'
    const { subject, html, text } = renderRequestAlert(alert)
    const r = await sendMail({
      to,
      subject,
      html,
      text,
      // Replies go to the customer when we know their address.
      replyTo: clean(alert.email) || null,
      idempotencyKey: `request-alert:${dedupeKey}`.slice(0, 256),
      template: 'request-alert',
    })
    if (!r.success) console.error('[request-alert] not sent', alert.kind, r.reason)
    return r.success ? 'sent' : 'failed'
  } catch (e) {
    console.error('[request-alert] failed', alert.kind, e instanceof Error ? e.message : e)
    return 'failed'
  }
}

/**
 * Fire-and-forget after the request was saved: the action never waits for or fails on this email.
 * Read request-scoped values (form fields, locale) before calling.
 */
export function alertRequest(
  input: Omit<RequestAlert, 'name' | 'at'> & {
    dedupeKey: string
    /** Best-effort submitter name, resolved after the response (e.g. Auth metadata). Errors = no name. */
    resolveName?: () => Promise<string | null>
  }
): void {
  if (!requestAlertRecipient()) return
  const at = new Date()
  try {
    void runAfterResponse('request-alert', async () => {
      let name: string | null = null
      try {
        name = (await input.resolveName?.()) ?? null
      } catch (e) {
        console.error('[request-alert] name lookup failed', e instanceof Error ? e.message : e)
      }
      const { resolveName: _r, dedupeKey, ...rest } = input
      void _r
      await sendRequestAlert({ ...rest, name, at }, dedupeKey)
    })
  } catch (e) {
    console.error('[request-alert] schedule failed', e instanceof Error ? e.message : e)
  }
}
