/**
 * Dashboard "Customer Since" (Vera, Oct 4 2026; Ezequiel's decision): days since the customer's FIRST
 * payment. It used to read the newest paid Stripe invoice (invoices.list returns newest first), so it
 * reset to "Today" on every renewal and every proration invoice.
 *
 * Source: the oldest billing_ledger row for the user, the same table that feeds Total Paid (one row
 * per paid invoice, written by the invoice.paid webhook, stamped with the payment time). Fallback
 * when the user has no ledger rows (for example the webhook has not landed yet): the earliest
 * `start_date ?? created` across the subscriptions the dashboard already lists, skipping the ones
 * that never took a payment (see NEVER_PAID_STATUSES). No extra Stripe call.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** The subscription fields the fallback reads (Stripe Unix seconds). */
export type SubscriptionStartLike = { start_date?: number | null; created?: number | null; status?: string | null }

/**
 * Subscriptions the fallback skips because they never took a payment (Vera, Oct 4, 31d2736 Info 2):
 * incomplete / incomplete_expired (first invoice never paid) and trialing. Customer Since means the
 * first PAYMENT, and a trial has not paid yet; the app has no trial flow today, so this is defensive.
 * Canceled, past_due, unpaid and paused ones did pay at some point and still count.
 */
export const NEVER_PAID_STATUSES: ReadonlySet<string> = new Set(['incomplete', 'incomplete_expired', 'trialing'])

/** When the first payment happened: the oldest ledger row, else the earliest subscription start; null if neither. */
export function firstPaymentDate(
  oldestLedgerCreatedAt: string | null | undefined,
  subscriptions: readonly SubscriptionStartLike[] = []
): Date | null {
  if (oldestLedgerCreatedAt) {
    const t = Date.parse(oldestLedgerCreatedAt)
    if (Number.isFinite(t)) return new Date(t)
  }
  const starts = subscriptions
    .filter((s) => !(s.status && NEVER_PAID_STATUSES.has(s.status)))
    .map((s) => s.start_date ?? s.created)
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0)
  return starts.length > 0 ? new Date(Math.min(...starts) * 1000) : null
}

/** Whole days from `since` to `now` (0 on the first day, never negative). */
export function daysSince(since: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS))
}
