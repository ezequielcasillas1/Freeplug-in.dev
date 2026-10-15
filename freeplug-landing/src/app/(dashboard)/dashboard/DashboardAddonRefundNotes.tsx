import { AddonRefundNotes } from '@/components/plans/AddonRefundNotes'
import { listInvoicesForCustomer, type InvoiceRow } from '@/lib/stripe/billing-routing'
import { getStripe } from '@/lib/stripe/server'

/**
 * Aria, Oct 4 9:57: the add-on refund note on the main dashboard too, with the same 30-day window and
 * wording as the Plans page (the same AddonRefundNotes, from the same invoice list). A Stripe error shows
 * nothing (the Plans page and the email still explain it).
 */
export async function DashboardAddonRefundNotes({ customerId, now }: { customerId: string; now?: Date }) {
  let invoices: InvoiceRow[] | null = null
  try {
    invoices = await listInvoicesForCustomer(getStripe(), customerId)
  } catch (e) {
    console.error('[dashboard] invoice list for refund notes failed', e instanceof Error ? e.message : e)
  }
  return <AddonRefundNotes invoices={invoices} now={now} />
}
