import type { InvoiceRow } from '@/lib/stripe/billing-routing'
import { addonNameList, addonRefundNote } from '@/lib/plans/ladder-copy'
import { formatNoteDate } from '@/lib/plans/note-date'

/** How long the Plans page keeps explaining an automatic add-on refund (the email says it too). */
export const ADDON_REFUND_NOTE_DAYS = 30

/**
 * Aria, Oct 4 9:27 / 9:57: the note for every add-on charge refunded automatically in the last 30 days
 * (Plans page AND the dashboard), read from the invoice's refund metadata (reason + card / credit split),
 * newest first. Also the L-1 refund of a turned-off add-on still billed at renewal.
 */
export type AddonRefundNoteItem = {
  id: string
  text: string
  /** Lina 10:33: "Oct 4" (year only when not this year), America/Chicago. */
  dateLabel: string
  /** ISO time behind dateLabel: the refund (recorded on the invoice), else the invoice date. */
  at: string
}

/** The note's date: when the refund was made (invoice mark), or the invoice date on older invoices. */
const noteTime = (r: InvoiceRow) => r.addonRefund?.refundedAt ?? r.created

export function recentAddonRefundNotes(invoices: readonly InvoiceRow[] | null | undefined, now: Date = new Date()): AddonRefundNoteItem[] {
  const since = now.getTime() - ADDON_REFUND_NOTE_DAYS * 86_400_000
  return (invoices ?? [])
    .filter((r) => r.addonRefund && new Date(noteTime(r)).getTime() >= since)
    .map((r) => {
      const x = r.addonRefund!
      const at = noteTime(r)
      return { id: r.id, text: addonRefundNote(addonNameList(x.addons), x.reason, x.cardCents, x.creditCents, x.carriedCents ?? 0), dateLabel: formatNoteDate(new Date(at), now), at }
    })
}

export function AddonRefundNotes({ invoices, now }: { invoices: readonly InvoiceRow[] | null | undefined; now?: Date }) {
  const notes = recentAddonRefundNotes(invoices, now)
  if (notes.length === 0) return null
  return (
    <div className="max-w-2xl mb-6 space-y-2" data-testid="addon-refund-notes">
      {notes.map((n) => (
        <div key={n.id} role="status" data-testid="addon-refund-note" className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900">
          {/* Lina 10:33: a small gray date line at the top (the app's text-xs text-gray-500 note style). */}
          <p className="mb-1 text-xs text-gray-500" data-testid="addon-refund-note-date">
            <time dateTime={n.at}>{n.dateLabel}</time>
          </p>
          <p data-testid="addon-refund-note-text">{n.text}</p>
        </div>
      ))}
    </div>
  )
}
