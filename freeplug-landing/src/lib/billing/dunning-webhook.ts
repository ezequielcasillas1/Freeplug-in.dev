import type Stripe from 'stripe'
import { openDunning, resolveDunning, type DunningStore } from './dunning'

/** The subscription an invoice bills (newer API: parent.subscription_details), or null for one-off invoices. */
export function subscriptionIdOfInvoice(inv: Stripe.Invoice): string | null {
  const parent = (inv as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null }).parent
  const s = parent?.subscription_details?.subscription ?? (inv as unknown as { subscription?: string | { id: string } | null }).subscription ?? null
  return typeof s === 'string' ? s : s?.id ?? null
}

/**
 * invoice.payment_failed -> open a case (day 0 = first failure); invoice.paid -> close it. Only hosting
 * subscription invoices count (maintenance quotes / one-off invoices are ignored).
 */
export async function dunningFromInvoiceEvent(
  store: DunningStore,
  type: 'invoice.payment_failed' | 'invoice.paid',
  inv: Stripe.Invoice,
  profileIdFor: (customerId: string) => Promise<string | null>,
  now: Date = new Date()
): Promise<'opened' | 'already_open' | 'resolved' | 'none' | 'skipped'> {
  const subId = subscriptionIdOfInvoice(inv)
  if (!subId || inv.metadata?.maintenance_quote_id) return 'skipped'
  if (type === 'invoice.paid') return resolveDunning(store, subId, now)
  const customer = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
  const profileId = customer ? await profileIdFor(customer) : null
  if (!profileId) return 'skipped'
  return openDunning(store, { subscriptionId: subId, profileId, failedAt: now })
}
