/**
 * Owner alerts (Cheke, Oct 19 2026 10:30 AM CT): one plain email to the owner (OWNER_ALERT_EMAIL) per
 * important customer event. Pure formatting only (no I/O): subject, HTML and text. Never carries
 * secrets or card data; callers pass only names, emails, plan names, amounts and short reasons.
 */
export const OWNER_ALERT_KINDS = [
  'signup',
  'website_request',
  'maintenance_quote_request',
  'buyout_quote_request',
  'change_request',
  'plan_purchased',
  'plan_upgraded',
  'plan_downgraded',
  'plan_canceled',
  'payment_failed',
  'refund',
  'refund_failed',
  'dispute_opened',
  'dispute_closed',
  'maintenance_quote_paid',
  'opt_out',
  'domain_request',
] as const
export type OwnerAlertKind = (typeof OWNER_ALERT_KINDS)[number]

export const OWNER_ALERT_LABELS: Record<OwnerAlertKind, string> = {
  signup: 'New signup',
  website_request: 'Website request',
  maintenance_quote_request: 'Maintenance quote request',
  buyout_quote_request: 'Buyout quote request',
  change_request: 'Edit request',
  plan_purchased: 'Plan purchased',
  plan_upgraded: 'Plan upgraded',
  plan_downgraded: 'Plan downgraded',
  plan_canceled: 'Plan canceled',
  payment_failed: 'Payment failed',
  refund: 'Refund',
  refund_failed: 'Refund failed',
  dispute_opened: 'Dispute opened',
  dispute_closed: 'Dispute closed',
  maintenance_quote_paid: 'Maintenance quote paid',
  opt_out: 'Unsubscribe',
  domain_request: 'Domain request',
}

/** Refunds, disputes and failed payments get a red "Needs attention" line at the top. */
export const NEEDS_ATTENTION: ReadonlySet<OwnerAlertKind> = new Set(['payment_failed', 'refund', 'refund_failed', 'dispute_opened', 'dispute_closed'])

export type OwnerAlertCustomer = {
  name?: string | null
  email?: string | null
  business?: string | null
  /** Plan step name, e.g. "Priority" (from entitlements, never a dollar string). */
  planName?: string | null
  /** hasWeekendReplies(entitlements): Priority ($55) and up. */
  weekendReplies?: boolean
}

export type OwnerAlert = {
  kind: OwnerAlertKind
  customer: OwnerAlertCustomer
  /** Event-specific lines, in order (pages wanted, templates, language, amount, reason...). */
  details?: ReadonlyArray<readonly [string, string | null | undefined]>
  /** Admin path for "Open in admin" (default /admin/customers). */
  adminPath?: string
  at?: Date
  /** Marks a test send ("TEST: sample signup alert"). */
  testLabel?: string
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
const clean = (s: string | null | undefined, max = 300) => (s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max)

export function ownerAlertSubject(a: OwnerAlert): string {
  const who = clean(a.customer.name, 80) || clean(a.customer.email, 120) || 'unknown customer'
  const plan = clean(a.customer.planName, 40)
  const base = `${OWNER_ALERT_LABELS[a.kind]}: ${who}${plan ? ` (${plan})` : ''}`
  return (a.testLabel ? `${a.testLabel} | ${base}` : base).slice(0, 200)
}

export function chicagoTime(at: Date): string {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(at) + ' CT'
  )
}

/** "$1,200.00" from cents (owner-facing; never a card number). */
export function usd(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents)) return null
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function renderOwnerAlert(a: OwnerAlert, appBaseUrl: string): { subject: string; html: string; text: string } {
  const subject = ownerAlertSubject(a)
  const c = a.customer
  const plan = clean(c.planName, 40)
  const rows: Array<[string, string]> = []
  if (clean(c.name)) rows.push(['Name', clean(c.name)])
  if (clean(c.email)) rows.push(['Email', clean(c.email)])
  if (clean(c.business)) rows.push(['Business', clean(c.business)])
  rows.push(['Plan', plan ? `${plan}${c.weekendReplies ? ' (gets weekend replies)' : ''}` : 'No plan'])
  for (const [k, v] of a.details ?? []) if (clean(v, 1000)) rows.push([clean(k, 60), clean(v, 1000)])
  rows.push(['Time', chicagoTime(a.at ?? new Date())])
  const adminUrl = `${appBaseUrl.replace(/\/+$/, '')}${a.adminPath ?? '/admin/customers'}`
  const attention = NEEDS_ATTENTION.has(a.kind)
  const heading = a.testLabel ? `${a.testLabel}: ${OWNER_ALERT_LABELS[a.kind]}` : OWNER_ALERT_LABELS[a.kind]

  const text = [
    attention ? 'NEEDS ATTENTION' : null,
    heading,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `Open in admin: ${adminUrl}`,
  ]
    .filter((l) => l !== null)
    .join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:24px">
${attention ? '<p style="margin:0 0 12px;color:#b91c1c;font-weight:bold">Needs attention</p>' : ''}<h1 style="margin:0 0 16px;font-size:18px">${esc(heading)}</h1>
<table style="border-collapse:collapse;width:100%;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#71717a;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
    .join('')}</table>
<p style="margin:20px 0 0"><a href="${esc(adminUrl)}" style="color:#ba3d3d;font-weight:bold">Open in admin</a></p>
</div></body></html>`
  return { subject, html, text }
}
