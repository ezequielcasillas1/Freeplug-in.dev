import type Stripe from 'stripe'
import { DOWNGRADE_REFUND_CENTS } from '../plans/downgrade-refund-rule'
import { chargeIdOfInvoice } from '../buyout/ownership'

/**
 * The $100 -> $35 immediate downgrade's refund (rule in src/lib/plans/downgrade-refund-rule.ts).
 * The refund goes against the charge of the subscription's latest PAID invoice, amount =
 * min($50, amount paid, what is still unrefunded on that charge). Nothing refundable (no paid
 * invoice, no charge, already refunded) = null: the caller falls back to the normal deferred
 * downgrade and logs it.
 */
export type DowngradeRefundTarget = { invoiceId: string; chargeId: string; amountCents: number; /** Our own refund for this subscription+invoice already exists (a retry after a failed switch): switch, don't refund again. */ alreadyDone?: boolean }
export type DowngradeRefundSkip = { skip: 'no_paid_invoice' | 'no_charge' | 'already_refunded' | 'nothing_paid' }

export const DOWNGRADE_REFUND_KIND = 'downgrade_refund_100_to_35'

export function downgradeRefundIdempotencyKey(subscriptionId: string, invoiceId: string): string {
  return `downgrade-refund:${subscriptionId}:${invoiceId}`
}
export function downgradeSwitchIdempotencyKey(subscriptionId: string, invoiceId: string): string {
  return `downgrade-now:${subscriptionId}:${invoiceId}`
}

export async function findDowngradeRefund(stripe: Stripe, subscriptionId: string): Promise<DowngradeRefundTarget | DowngradeRefundSkip> {
  const list = await stripe.invoices.list({ subscription: subscriptionId, status: 'paid', limit: 1 })
  const inv = list.data[0]
  if (!inv) return { skip: 'no_paid_invoice' }
  const paid = inv.amount_paid ?? 0
  if (paid <= 0) return { skip: 'nothing_paid' }
  const chargeId = await chargeIdOfInvoice(inv as unknown as Parameters<typeof chargeIdOfInvoice>[0], stripe as unknown as Parameters<typeof chargeIdOfInvoice>[1])
  if (!chargeId) return { skip: 'no_charge' }
  const charge = await stripe.charges.retrieve(chargeId)
  const ours = (await stripe.refunds.list({ charge: chargeId, limit: 100 })).data.find(
    (r) => r.metadata?.kind === DOWNGRADE_REFUND_KIND && r.metadata?.subscription === subscriptionId && r.metadata?.invoice === inv.id && r.status !== 'failed' && r.status !== 'canceled'
  )
  if (ours) return { invoiceId: inv.id as string, chargeId, amountCents: ours.amount, alreadyDone: true }
  // Any earlier refund on this charge (ours from a double click, or a manual one): never refund again.
  if ((charge.amount_refunded ?? 0) > 0 || charge.refunded) return { skip: 'already_refunded' }
  const amountCents = Math.min(DOWNGRADE_REFUND_CENTS, paid, charge.amount ?? 0)
  if (amountCents <= 0) return { skip: 'nothing_paid' }
  return { invoiceId: inv.id as string, chargeId, amountCents }
}

/** Where the $50 of a $100 -> $35 downgrade goes (Cheke, Oct 23): toward the buyout, or Freeplug wallet credit. */
export type DowngradeCreditChoice = 'buyout' | 'wallet'
/** No choice sent = buyout (no money moves; the full $100 keeps counting toward ownership). */
export const DEFAULT_DOWNGRADE_CREDIT_CHOICE: DowngradeCreditChoice = 'buyout'
export function parseDowngradeCreditChoice(v: unknown): DowngradeCreditChoice {
  return v === 'wallet' ? 'wallet' : DEFAULT_DOWNGRADE_CREDIT_CHOICE
}

/** Our wallet credit for this subscription+invoice already on the customer balance (retry after a failed switch). */
export async function findWalletCredit(stripe: Stripe, customer: string, subscriptionId: string, invoiceId: string): Promise<string | null> {
  const list = await stripe.customers.listBalanceTransactions(customer, { limit: 100 })
  const hit = list.data.find((t) => t.metadata?.kind === DOWNGRADE_REFUND_KIND && t.metadata?.subscription === subscriptionId && t.metadata?.invoice === invoiceId)
  return hit?.id ?? null
}
