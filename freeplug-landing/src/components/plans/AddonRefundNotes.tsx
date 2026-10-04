import type { InvoiceRow } from '@/lib/stripe/billing-routing'
import { ADDON_NAMES, addonRefundNote } from '@/lib/plans/ladder-copy'

/** How long the Plans page keeps explaining an automatic add-on refund (the email says it too). */
export const ADDON_REFUND_NOTE_DAYS = 30

/**
 * Aria, Oct 4 9:27: the Plans page note for every add-on charge refunded automatically in the last 30
 * days, read from the invoice's refund metadata (reason + card / credit split), newest first.
 */
export function recentAddonRefundNotes(invoices: readonly InvoiceRow[] | null | undefined, now: Date = new Date()): { id: string; text: string }[] {
  const since = now.getTime() - ADDON_REFUND_NOTE_DAYS * 86_400_000
  return (invoices ?? [])
    .filter((r) => r.addonRefund && new Date(r.created).getTime() >= since)
    .map((r) => {
      const x = r.addonRefund!
      return { id: r.id, text: addonRefundNote(ADDON_NAMES[x.addon], x.reason, x.cardCents, x.creditCents) }
    })
}

export function AddonRefundNotes({ invoices, now }: { invoices: readonly InvoiceRow[] | null | undefined; now?: Date }) {
  const notes = recentAddonRefundNotes(invoices, now)
  if (notes.length === 0) return null
  return (
    <div className="max-w-2xl mb-6 space-y-2" data-testid="addon-refund-notes">
      {notes.map((n) => (
        <p key={n.id} role="status" data-testid="addon-refund-note" className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900">
          {n.text}
        </p>
      ))}
    </div>
  )
}
