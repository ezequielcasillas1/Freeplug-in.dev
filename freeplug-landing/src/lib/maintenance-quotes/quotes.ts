/**
 * Admin maintenance quotes (Cheke, Oct 18 2026): Save draft -> Send (Stripe TEST-mode invoice,
 * collection_method send_invoice, days_until_due 7) -> Unpaid -> Paid (invoice.paid webhook). Void voids the
 * Stripe invoice. A second Send does nothing: the database claim (draft + not started) lets one Send through,
 * and the Stripe calls carry idempotency keys tied to the quote id.
 */
export const QUOTE_DAYS_UNTIL_DUE = 7
export const QUOTE_MIN_CENTS = 5000
export const QUOTE_MAX_CENTS = 10000
export const QUOTE_DESCRIPTION_MAX = 500

export type QuoteStatus = 'draft' | 'unpaid' | 'paid' | 'void'
export type MaintenanceQuote = {
  id: string
  change_request_id: string
  user_id: string
  amount_cents: number
  description: string
  days_until_due: number
  status: QuoteStatus
  stripe_invoice_id: string | null
  send_started_at: string | null
  sent_at: string | null
  paid_at: string | null
  voided_at: string | null
  created_at: string
}

// Sable's wording (Oct 18 QA): "Send quote", "Sent, unpaid", voided quotes stay visible as "Void".
export const QUOTE_BADGE: Record<QuoteStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-zinc-100 text-zinc-700' },
  unpaid: { label: 'Sent, unpaid', className: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800' },
  void: { label: 'Void', className: 'bg-red-50 text-red-700' },
}
export const QUOTE_SEND_LABEL = 'Send quote'
export const QUOTE_VOID_CONFIRM = "Void this quote? The invoice can't be paid after this."
/** Sable (Oct 18): exact confirm text; price as "$75" (or "$75.50"). */
export const quoteSendConfirmText = (customer: string, cents: number) =>
  `Send this quote to ${customer} for $${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}? They get a Stripe invoice and have 7 days to pay.`
export const QUOTE_CONFIRM_SEND_LABEL = 'Send'
/** "Oct 25, 2026" (America/Chicago). */
export const quoteDueDate = (from: Date = new Date()) =>
  new Date(from.getTime() + QUOTE_DAYS_UNTIL_DUE * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
export const quoteSentToast = (sentAt: Date) => `Quote sent. It's due ${quoteDueDate(sentAt)}.`

/** "Due Oct 25, 2026" — fixed 7 days from today (or from when it was sent). */
export function quoteDueDateText(from: Date = new Date()): string {
  return `Due ${quoteDueDate(from)} (7 days after sending)`
}

/** Whole or cents dollars from the admin field ("75", "$75.50") -> cents within $50-$100. */
export function parseQuoteAmount(raw: string): { ok: true; cents: number } | { ok: false; error: string } {
  const t = String(raw ?? '').trim().replace(/^\$\s*/, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { ok: false, error: 'Enter an amount like 75 or 75.50.' }
  const cents = Math.round(Number(t) * 100)
  if (cents < QUOTE_MIN_CENTS || cents > QUOTE_MAX_CENTS) return { ok: false, error: 'Maintenance quotes are $50 to $100.' }
  return { ok: true, cents }
}

export interface QuoteStore {
  get(id: string): Promise<MaintenanceQuote | null>
  /** Atomically marks a draft as sending (status draft, send_started_at null). False = someone else has it. */
  claimSend(id: string, now: string): Promise<boolean>
  releaseSend(id: string): Promise<void>
  markSent(id: string, invoiceId: string, now: string): Promise<void>
  markVoid(id: string, now: string): Promise<void>
  stripeCustomerFor(userId: string): Promise<string | null>
}

export interface QuoteStripe {
  invoices: {
    create(p: Record<string, unknown>, o?: { idempotencyKey?: string }): Promise<{ id: string }>
    finalizeInvoice(id: string, p?: Record<string, unknown>, o?: { idempotencyKey?: string }): Promise<{ id: string; status?: string | null }>
    sendInvoice(id: string, p?: Record<string, unknown>, o?: { idempotencyKey?: string }): Promise<{ id: string }>
    voidInvoice(id: string, p?: Record<string, unknown>, o?: { idempotencyKey?: string }): Promise<{ id: string }>
  }
  invoiceItems: { create(p: Record<string, unknown>, o?: { idempotencyKey?: string }): Promise<{ id: string }> }
}

export type SendResult = { ok: true; outcome: 'sent' | 'noop'; invoiceId?: string } | { ok: false; error: string }

/** Refuses anything that is not a TEST key: this flow must never create a live invoice. */
export function assertTestModeKey(key: string | undefined): void {
  if (!key || !key.startsWith('sk_test_')) throw new Error('Maintenance quotes only send with a Stripe TEST key (sk_test_).')
}

export async function sendQuote(store: QuoteStore, stripe: QuoteStripe, id: string, now: Date = new Date()): Promise<SendResult> {
  const q = await store.get(id)
  if (!q) return { ok: false, error: 'Quote not found.' }
  if (q.status !== 'draft' || q.send_started_at) return { ok: true, outcome: 'noop', invoiceId: q.stripe_invoice_id ?? undefined }
  const customer = await store.stripeCustomerFor(q.user_id)
  if (!customer) return { ok: false, error: 'This customer has no Stripe customer yet.' }
  if (!(await store.claimSend(id, now.toISOString()))) return { ok: true, outcome: 'noop' }
  try {
    const key = (step: string) => `maintenance-quote-${id}-${step}`
    const meta = { maintenance_quote_id: id, change_request_id: q.change_request_id }
    const inv = await stripe.invoices.create(
      { customer, collection_method: 'send_invoice', days_until_due: QUOTE_DAYS_UNTIL_DUE, auto_advance: false, description: 'One-time maintenance', metadata: meta },
      { idempotencyKey: key('invoice') }
    )
    await stripe.invoiceItems.create(
      { customer, invoice: inv.id, amount: q.amount_cents, currency: 'usd', description: `One-time maintenance: ${q.description}`, metadata: meta },
      { idempotencyKey: key('item') }
    )
    await stripe.invoices.finalizeInvoice(inv.id, {}, { idempotencyKey: key('finalize') })
    await stripe.invoices.sendInvoice(inv.id, {}, { idempotencyKey: key('send') })
    await store.markSent(id, inv.id, now.toISOString())
    return { ok: true, outcome: 'sent', invoiceId: inv.id }
  } catch (e) {
    await store.releaseSend(id) // the same idempotency keys make a retry safe
    return { ok: false, error: `Stripe: ${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function voidQuote(store: QuoteStore, stripe: QuoteStripe, id: string, now: Date = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const q = await store.get(id)
  if (!q) return { ok: false, error: 'Quote not found.' }
  if (q.status === 'void') return { ok: true }
  if (q.status === 'paid') return { ok: false, error: 'A paid quote can’t be voided.' }
  if (q.stripe_invoice_id) {
    try {
      await stripe.invoices.voidInvoice(q.stripe_invoice_id, {}, { idempotencyKey: `maintenance-quote-${id}-void` })
    } catch (e) {
      return { ok: false, error: `Stripe: ${e instanceof Error ? e.message : String(e)}` }
    }
  }
  await store.markVoid(id, now.toISOString())
  return { ok: true }
}

/** Webhook: a paid quote invoice -> Paid; a voided one -> void. Returns true when a quote row matched. */
export type QuoteWebhookDb = {
  from(t: 'maintenance_quotes'): {
    update(v: Record<string, unknown>): { eq(k: string, v: string): { neq(k: string, v: string): { select(c: string): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> } } }
  }
}
export async function markQuoteInvoice(db: QuoteWebhookDb, invoiceId: string, status: 'paid' | 'void', at: string): Promise<boolean> {
  const patch = status === 'paid' ? { status: 'paid', paid_at: at, updated_at: at } : { status: 'void', voided_at: at, updated_at: at }
  const { data, error } = await db.from('maintenance_quotes').update(patch).eq('stripe_invoice_id', invoiceId).neq('status', status).select('id')
  if (error) throw new Error(error.message)
  return (data?.length ?? 0) > 0
}
