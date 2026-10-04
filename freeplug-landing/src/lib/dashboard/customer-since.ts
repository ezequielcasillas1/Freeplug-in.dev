/**
 * Dashboard "Customer Since" (Vera, Oct 4 2026; Ezequiel's decision): days since the customer's FIRST
 * payment. It used to read the newest paid Stripe invoice (invoices.list returns newest first), so it
 * reset to "Today" on every renewal and every proration invoice.
 *
 * Source: the oldest billing_ledger row for the user, the same table that feeds Total Paid (one row
 * per paid invoice, written by the invoice.paid webhook). Fallback when the user has no ledger rows
 * (for example the webhook has not landed yet): the earliest `start_date ?? created` across the
 * subscriptions the dashboard already lists. No extra Stripe call.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** The subscription fields the fallback reads (Stripe Unix seconds). */
export type SubscriptionStartLike = { start_date?: number | null; created?: number | null }

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
    .map((s) => s.start_date ?? s.created)
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0)
  return starts.length > 0 ? new Date(Math.min(...starts) * 1000) : null
}

/** Whole days from `since` to `now` (0 on the first day, never negative). */
export function daysSince(since: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS))
}
