import { formatUsdIn, intlLocale, noWrapDate } from '@/i18n/format'
import { translatorFor, type Translate } from '@/i18n/translate'
import type { AppLocale } from '@/i18n/config'
/** Recent activity helpers for billing_ledger rows (kept out of the 'use server' actions file). */

/**
 * Columns read from billing_ledger for Recent activity. Only columns created by
 * supabase/migrations (id, created_at, amount_cents) - there is no description column, and
 * selecting one fails the whole query with 42703. Guarded by billing-ledger-columns.test.ts.
 */
export const BILLING_ACTIVITY_COLUMNS = 'id, created_at, amount_cents'

/** Formats a ledger date as e.g. "Oct 3, 2026" (UTC, so server and tests agree). */
function formatLedgerDate(d: Date, locale: AppLocale = 'en'): string {
  return noWrapDate(
    locale,
    d.toLocaleDateString(intlLocale(locale), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  )
}

/**
 * Activity label for a billing_ledger row, built only from columns that exist in every
 * environment (amount_cents, created_at): "Payment of $35.00 on Oct 3, 2026".
 */
export function paymentActivityLabel(
  amountCents: number | null | undefined,
  createdAt: string | null | undefined,
  locale: AppLocale = 'en',
  t: Translate = translatorFor(locale)
): string {
  const amount =
    typeof amountCents === 'number' && Number.isFinite(amountCents)
      ? formatUsdIn(locale, amountCents, 2)
      : null
  const date = createdAt ? new Date(createdAt) : null
  const day = date && !Number.isNaN(date.getTime()) ? formatLedgerDate(date, locale) : null
  if (amount && day) return t('dashboard.home.payment.amountOnDate', { amount, date: day })
  if (amount) return t('dashboard.home.payment.amount', { amount })
  if (day) return t('dashboard.home.payment.onDate', { date: day })
  return t('dashboard.home.payment.plain')
}
