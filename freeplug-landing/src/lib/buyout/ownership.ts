/**
 * Every dollar toward buyout (Cheke, Oct 18 2026). Each payment is one ledger row keyed on its Stripe CHARGE,
 * so invoice.paid and charge.succeeded for the same money count once. Refunds (one row per refund id) and disputes subtract (a won
 * dispute restores). Payments are "still clearing" for 14 days, then cleared. Amounts are before tax and not
 * net of Stripe fees. The buyout price is not changed here (website_requests.buyout_price_cents).
 *
 * The rules live in applyEntry(): the SQL function public.record_ownership_entry (migration 20261018090000)
 * mirrors them for the database; memoryOwnershipStore uses them directly for tests.
 */
export const CLEARING_DAYS = 14
const DAY_MS = 86_400_000

export type OwnershipKind = 'payment' | 'refund' | 'dispute'
export type OwnershipSource = 'invoice' | 'charge' | 'stripe'
export type OwnershipEntry = {
  entry_key: string
  profile_id: string
  stripe_charge_id: string
  kind: OwnershipKind
  source: OwnershipSource
  amount_cents: number
  final: boolean
  occurred_at: string
  clears_at: string | null
}
export type UpsertResult = 'inserted' | 'updated' | 'unchanged'

export interface OwnershipStore {
  upsert(e: Omit<OwnershipEntry, 'clears_at'>): Promise<UpsertResult>
  /** The payment row for a charge (to find the profile and cap refunds/disputes), or null. */
  paymentForCharge(chargeId: string): Promise<OwnershipEntry | null>
}

/** Pure merge rule (same as the SQL function). Returns the new row, or null when nothing changes. */
export function applyEntry(old: OwnershipEntry | null, next: Omit<OwnershipEntry, 'clears_at'>): OwnershipEntry | null {
  if (!old) {
    const clears = next.kind === 'payment' ? new Date(Date.parse(next.occurred_at) + CLEARING_DAYS * DAY_MS).toISOString() : null
    return { ...next, clears_at: clears }
  }
  if (next.kind === 'payment' && old.source === 'charge' && next.source === 'invoice' && old.amount_cents !== next.amount_cents)
    return { ...old, amount_cents: next.amount_cents, source: 'invoice' }
  if ((next.kind === 'refund' || next.kind === 'dispute') && !old.final && (old.amount_cents !== next.amount_cents || next.final))
    return { ...old, amount_cents: next.amount_cents, final: next.final }
  return null
}

export function memoryOwnershipStore(rows: Map<string, OwnershipEntry> = new Map()): OwnershipStore & { rows: Map<string, OwnershipEntry> } {
  return {
    rows,
    async upsert(e) {
      const old = rows.get(e.entry_key) ?? null
      const merged = applyEntry(old, e)
      if (!merged) return 'unchanged'
      rows.set(e.entry_key, merged)
      return old ? 'updated' : 'inserted'
    },
    async paymentForCharge(chargeId) {
      return rows.get(`pay:${chargeId}`) ?? null
    },
  }
}

type Rpc = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>
  from(t: string): {
    select(c: string): { eq(k: string, v: string): { maybeSingle(): PromiseLike<{ data: unknown; error: { message: string } | null }> } }
  }
}
export function supabaseOwnershipStore(db: Rpc): OwnershipStore {
  return {
    async upsert(e) {
      const { data, error } = await db.rpc('record_ownership_entry', {
        p_entry_key: e.entry_key,
        p_profile_id: e.profile_id,
        p_charge_id: e.stripe_charge_id,
        p_kind: e.kind,
        p_amount_cents: e.amount_cents,
        p_occurred_at: e.occurred_at,
        p_source: e.source,
        p_final: e.final,
      })
      if (error) throw new Error(`record_ownership_entry: ${error.message}`)
      return data as UpsertResult
    },
    async paymentForCharge(chargeId) {
      const { data, error } = await db.from('ownership_ledger').select('*').eq('entry_key', `pay:${chargeId}`).maybeSingle()
      if (error) throw new Error(error.message)
      return (data as OwnershipEntry | null) ?? null
    },
  }
}

// ------------------------------------------------------------------ Stripe -> ledger

type InvoiceLike = {
  id: string
  amount_paid: number
  tax?: number | null
  total_taxes?: { amount: number }[] | null
  status_transitions?: { paid_at?: number | null } | null
  created?: number
}
type ChargeLike = {
  id: string
  amount: number
  amount_refunded?: number
  paid?: boolean
  status?: string
  captured?: boolean
  created: number
}
type DisputeLike = { id: string; charge: string | { id: string }; amount: number; status: string; created: number }

const iso = (unix: number | null | undefined) => new Date((unix ?? 0) * 1000).toISOString()

/** Amount paid before tax (not net of fees). */
export function invoiceAmountBeforeTax(inv: InvoiceLike): number {
  const tax = Array.isArray(inv.total_taxes) ? inv.total_taxes.reduce((n, t) => n + Math.max(0, t.amount ?? 0), 0) : Math.max(0, inv.tax ?? 0)
  return Math.max(0, (inv.amount_paid ?? 0) - tax)
}

/** invoice.paid: the payment for its charge (amount before tax). Tips and add-ons on the invoice count too. */
export async function recordInvoicePayment(store: OwnershipStore, profileId: string, inv: InvoiceLike, chargeId: string | null): Promise<UpsertResult> {
  const amount = invoiceAmountBeforeTax(inv)
  if (amount <= 0) return 'unchanged'
  const charge = chargeId ?? `inv:${inv.id}` // paid without a charge (e.g. out of band): keyed on the invoice
  return store.upsert({
    entry_key: `pay:${charge}`,
    profile_id: profileId,
    stripe_charge_id: charge,
    kind: 'payment',
    source: 'invoice',
    amount_cents: amount,
    final: false,
    occurred_at: iso(inv.status_transitions?.paid_at ?? inv.created),
  })
}

/** charge.succeeded: a charge (with or without an invoice). Same key as its invoice, so it counts once. */
export async function recordChargePayment(store: OwnershipStore, profileId: string, ch: ChargeLike): Promise<UpsertResult> {
  if (ch.paid === false || (ch.status && ch.status !== 'succeeded') || ch.captured === false || ch.amount <= 0) return 'unchanged'
  return store.upsert({
    entry_key: `pay:${ch.id}`,
    profile_id: profileId,
    stripe_charge_id: ch.id,
    kind: 'payment',
    source: 'charge',
    amount_cents: ch.amount,
    final: false,
    occurred_at: iso(ch.created),
  })
}

/** Scales a charge-level amount (tax included) to the payment row's before-tax amount, capped at it. */
function scaled(payment: OwnershipEntry | null, chargeAmount: number, cents: number): number {
  if (!payment) return Math.max(0, cents)
  const ratio = chargeAmount > 0 ? payment.amount_cents / chargeAmount : 1
  return Math.min(payment.amount_cents, Math.max(0, Math.round(cents * Math.min(1, ratio))))
}

export type RefundLike = { id: string; amount: number; status?: string | null; created: number; charge?: string | { id: string } | null }

/**
 * One ledger row per Stripe refund id (Aria): `refund:<re_id>`. Pending and succeeded refunds subtract; a refund
 * that failed or was canceled is restored to 0 and final, so a late replay can't re-subtract it. Unknown charge = skipped.
 */
export async function recordRefundObject(store: OwnershipStore, r: RefundLike, chargeAmount: number | null, profileId?: string): Promise<UpsertResult> {
  const chargeId = refId(r.charge ?? null)
  if (!chargeId) return 'unchanged'
  const payment = await store.paymentForCharge(chargeId)
  const owner = payment?.profile_id ?? profileId
  if (!owner) return 'unchanged'
  const failed = r.status === 'failed' || r.status === 'canceled'
  const amount = failed ? 0 : scaled(payment, chargeAmount ?? r.amount, r.amount)
  if (amount <= 0 && !failed) return 'unchanged'
  return store.upsert({
    entry_key: `refund:${r.id}`,
    profile_id: owner,
    stripe_charge_id: chargeId,
    kind: 'refund',
    source: 'stripe',
    amount_cents: -amount,
    final: failed,
    occurred_at: iso(r.created),
  })
}

/** charge.refunded: records each of the charge's refunds by its own id. */
export async function recordRefunds(store: OwnershipStore, ch: ChargeLike, refunds: readonly RefundLike[], profileId?: string): Promise<UpsertResult[]> {
  const out: UpsertResult[] = []
  for (const r of refunds) out.push(await recordRefundObject(store, { ...r, charge: r.charge ?? ch.id }, ch.amount, profileId))
  return out
}

/** charge.dispute.created / updated / closed. Won = restored (0), lost = subtracted for good. */
export async function recordDispute(store: OwnershipStore, d: DisputeLike, chargeAmount?: number): Promise<UpsertResult> {
  const chargeId = typeof d.charge === 'string' ? d.charge : d.charge.id
  const payment = await store.paymentForCharge(chargeId)
  if (!payment) return 'unchanged'
  const won = d.status === 'won'
  const final = won || d.status === 'lost'
  const amount = won ? 0 : -scaled(payment, chargeAmount ?? d.amount, d.amount)
  return store.upsert({
    entry_key: `dispute:${d.id}`,
    profile_id: payment.profile_id,
    stripe_charge_id: chargeId,
    kind: 'dispute',
    source: 'stripe',
    amount_cents: amount,
    final,
    occurred_at: iso(d.created),
  })
}

type CreditRow = Pick<OwnershipEntry, 'kind' | 'amount_cents' | 'clears_at' | 'stripe_charge_id'>

/**
 * Per-charge totals, shared by the customer line and buyout eligibility (Oct 18 QA r2), so they always agree:
 * each charge counts its payment net of that charge's refunds and disputes (never below 0). A refund or dispute
 * with no matching payment row counts nothing. A charge is "still clearing" while its payment is under 14 days old.
 *   paidCents     = X ("Paid toward ownership")
 *   clearingCents = Y ("still clearing"), the part of X from charges not yet cleared
 *   clearedCents  = X - Y = buyout eligibility credit
 */
export function ownershipTotals(rows: readonly CreditRow[], now: Date = new Date()): { paidCents: number; clearingCents: number; clearedCents: number } {
  const t = now.getTime()
  const byCharge = new Map<string, { pay: CreditRow | null; adj: number }>()
  for (const r of rows) {
    const g = byCharge.get(r.stripe_charge_id) ?? { pay: null, adj: 0 }
    if (r.kind === 'payment') g.pay = r
    else g.adj += r.amount_cents
    byCharge.set(r.stripe_charge_id, g)
  }
  let paid = 0
  let clearing = 0
  for (const { pay, adj } of byCharge.values()) {
    if (!pay) continue
    const net = Math.max(0, pay.amount_cents + adj)
    paid += net
    if (!(pay.clears_at && Date.parse(pay.clears_at) <= t)) clearing += net
  }
  return { paidCents: paid, clearingCents: clearing, clearedCents: paid - clearing }
}

/** Buyout eligibility (Oct 18 QA): reads ownership_ledger and counts CLEARED charges only (see ownershipTotals). */
export function buyoutCreditCents(rows: readonly CreditRow[], now: Date = new Date()): number {
  return ownershipTotals(rows, now).clearedCents
}

/** Cleared credit toward buyout per profile, read from ownership_ledger (service role). */
export async function fetchBuyoutCredit(
  db: { from(t: string): { select(c: string): { in(k: string, v: string[]): PromiseLike<{ data: unknown; error: { message: string } | null }> } } },
  profileIds: string[],
  now: Date = new Date()
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (profileIds.length === 0) return out
  const { data, error } = await db.from('ownership_ledger').select('profile_id, stripe_charge_id, kind, amount_cents, clears_at').in('profile_id', profileIds)
  if (error) throw new Error(`ownership_ledger: ${error.message}`)
  const byProfile = new Map<string, CreditRow[]>()
  for (const r of (data ?? []) as (CreditRow & { profile_id: string })[]) {
    const list = byProfile.get(r.profile_id) ?? []
    list.push(r)
    byProfile.set(r.profile_id, list)
  }
  for (const id of profileIds) out.set(id, buyoutCreditCents(byProfile.get(id) ?? [], now))
  return out
}

/** Sable (Oct 18): gray note under the ownership line. */
export const OWNERSHIP_NOTE = "Payments count after 14 days. Refunds aren't counted."
export const ADMIN_BUYOUT_CLEARED = 'Cleared toward buyout'

const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`
export const paidTowardOwnershipLine = (cents: number) => `Paid toward ownership: ${usd(cents)}`
export const stillClearingLine = (cents: number) => `(includes ${usd(cents)} still clearing)`
/** DRAFT Spanish (box-translated Oct 19, for Sable): the three customer ownership lines. */
export const OWNERSHIP_COPY_ES = {
  note: 'Los pagos cuentan después de 14 días. Los reembolsos no cuentan.',
  paidToward: (cents: number) => `Pagado para quedarte con tu sitio: ${usd(cents)}`,
  stillClearing: (cents: number) => `(incluye ${usd(cents)} que aún se está procesando)`,
}

type PaymentRef = { charge?: string | { id: string } | null; payment_intent?: string | { id: string; latest_charge?: string | { id: string } | null } | null }
type StripeForCharge = {
  invoicePayments: { list(p: { invoice: string; limit?: number }): Promise<{ data: { status?: string; payment: PaymentRef }[] }> }
  paymentIntents: { retrieve(id: string): Promise<{ latest_charge?: string | { id: string } | null }> }
}
const refId = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : (v?.id ?? null))

/** The charge that paid an invoice (legacy invoice.charge, invoice payments, or the PaymentIntent's latest charge). */
export async function chargeIdOfInvoice(inv: { id: string; charge?: string | { id: string } | null; payments?: { data?: { status?: string; payment: PaymentRef }[] } | null }, stripe: StripeForCharge): Promise<string | null> {
  const legacy = refId(inv.charge ?? null)
  if (legacy) return legacy
  let payments = inv.payments?.data
  if (!payments || payments.length === 0) {
    if (typeof stripe.invoicePayments?.list !== 'function') return null
    payments = (await stripe.invoicePayments.list({ invoice: inv.id, limit: 10 })).data ?? []
  }
  const paid = payments.find((p) => p.status === 'paid') ?? payments[0]
  if (!paid) return null
  const direct = refId(paid.payment.charge ?? null)
  if (direct) return direct
  const pi = paid.payment.payment_intent
  if (!pi) return null
  if (typeof pi !== 'string' && pi.latest_charge) return refId(pi.latest_charge)
  return refId((await stripe.paymentIntents.retrieve(refId(pi)!)).latest_charge ?? null)
}
