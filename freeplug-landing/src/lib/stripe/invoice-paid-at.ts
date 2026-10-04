import type Stripe from 'stripe'

/**
 * When an invoice was paid, as an ISO timestamp for billing_ledger.created_at (Vera, Oct 4: 31d2736
 * Low 1). Stripe's status_transitions.paid_at, else the invoice's created time (Unix seconds).
 * Without it the row was stamped with the webhook DELIVERY time (column default now()), so a retried,
 * late or replayed invoice.paid moved Customer Since and the Recent activity dates forward.
 * Null when neither is a usable timestamp: the column default applies, as before.
 */
export function invoicePaidAtIso(
  inv: Pick<Stripe.Invoice, 'created'> & { status_transitions?: { paid_at?: number | null } | null }
): string | null {
  const paidAt = inv.status_transitions?.paid_at
  const secs = typeof paidAt === 'number' && paidAt > 0 ? paidAt : inv.created
  return typeof secs === 'number' && Number.isFinite(secs) && secs > 0 ? new Date(secs * 1000).toISOString() : null
}
