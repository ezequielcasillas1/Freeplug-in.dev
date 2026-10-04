// Aria, Oct 4 2:40 PM CT: while a small amount carried from the last change is still unbilled, the renewal
// line uses Stripe's upcoming-invoice total (never price + carried added up here). Relative imports only.
import type Stripe from 'stripe'

/**
 * The small amount carried from the last change that is still unbilled: Stripe's invoice_too_small rule
 * debits it to the customer balance (positive = owed) and adds it to the next finalized invoice. 0 when
 * none, or when the balance can't be read (the caller keeps its existing line).
 */
export async function carriedPendingCents(
  stripe: Pick<Stripe, 'customers'>,
  customer: string | { id: string } | null | undefined,
  log: (m: string) => void = (m) => console.error(m)
): Promise<number> {
  const id = typeof customer === 'string' ? customer : customer?.id
  if (!id) return 0
  try {
    const c = await stripe.customers.retrieve(id)
    const balance = 'deleted' in c && c.deleted ? 0 : ((c as Stripe.Customer).balance ?? 0)
    return balance > 0 ? balance : 0
  } catch (e) {
    log(`[next-bill] balance read failed on ${id}: ${e instanceof Error ? e.message : String(e)}`)
    return 0
  }
}

export type UpcomingBill = { totalCents: number; carriedCents: number }

/**
 * Stripe's upcoming invoice for the subscription (its next renewal), with optional item changes and no
 * proration. amount_due has the customer balance applied, so a carried debit is already in the total;
 * carriedCents is that debit (starting_balance > 0), 0 when nothing is carried (or it was already billed).
 */
export async function upcomingBill(
  stripe: Pick<Stripe, 'invoices'>,
  subscriptionId: string,
  items?: Stripe.InvoiceCreatePreviewParams.SubscriptionDetails.Item[]
): Promise<UpcomingBill> {
  const preview = await stripe.invoices.createPreview({
    subscription: subscriptionId,
    ...(items ? { subscription_details: { items, proration_behavior: 'none' } } : {}),
  })
  return { totalCents: Math.max(0, preview.amount_due), carriedCents: Math.max(0, preview.starting_balance ?? 0) }
}
