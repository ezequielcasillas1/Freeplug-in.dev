import { intlLocale, noWrapDate } from '@/i18n/format'
import type { AppLocale } from '@/i18n/config'
import type { InvoiceRow } from '@/lib/stripe/billing-routing'
import { useLadderCopy } from '@/lib/plans/use-ladder-copy'

const money = (cents: number, currency: string, locale: AppLocale = 'en') =>
  new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
const day = (iso: string, locale: AppLocale = 'en') =>
  noWrapDate(locale, new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)))

/**
 * Plans page billing (Aria, Oct 3 12:56): the card-update flow (portal session limited to
 * payment_method_update) and the invoice list, in the app. Shown with or without a planned switch.
 * `invoices` null = Stripe could not be reached (the list is left out, the card button stays).
 */
export function BillingTools({
  updateCardAction,
  invoices,
}: {
  updateCardAction: () => Promise<void>
  invoices: InvoiceRow[] | null
}) {
  const { LOCALE, BILLING_HEADING, DOWNLOAD_INVOICE_PDF, INVOICE_PLAN_PART, INVOICE_STATUS_LABEL, INVOICE_TIP_PART, INVOICES_EMPTY, INVOICES_HEADING, UPDATE_CARD_BUTTON, VIEW_INVOICE } = useLadderCopy()
  return (
    <section className="mt-10 max-w-4xl" data-testid="billing-tools">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{BILLING_HEADING}</h2>
      <form action={updateCardAction} className="mb-6">
        <button
          type="submit"
          className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          {UPDATE_CARD_BUTTON}
        </button>
      </form>
      {invoices === null ? null : (
        <div data-testid="invoice-list">
          <h3 className="text-base font-semibold text-gray-900 mb-2">{INVOICES_HEADING}</h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-600">{INVOICES_EMPTY}</p>
          ) : (
            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-2" data-invoice-id={inv.id}>
                  <span className="w-28 text-gray-700">{day(inv.created, LOCALE)}</span>
                  <span className="w-24 font-medium text-gray-900">{money(inv.totalCents, inv.currency, LOCALE)}</span>
                  <span className="w-16 text-gray-600">{INVOICE_STATUS_LABEL[inv.status]}</span>
                  {/* The tip on its own line, read right after the amount; shown under the links on wider screens. */}
                  {inv.tipCents > 0 ? (
                    <span className="w-full text-xs text-gray-600 sm:order-last sm:pl-[7.75rem]" data-testid="invoice-tip">
                      {INVOICE_PLAN_PART(money(inv.totalCents - inv.tipCents, inv.currency, LOCALE))} · {INVOICE_TIP_PART(money(inv.tipCents, inv.currency, LOCALE))}
                    </span>
                  ) : null}
                  {inv.hostedUrl ? (
                    <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" className="text-[#ba3d3d] underline">
                      {VIEW_INVOICE}
                    </a>
                  ) : null}
                  {inv.pdfUrl ? (
                    <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[#ba3d3d] underline">
                      {DOWNLOAD_INVOICE_PDF}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
