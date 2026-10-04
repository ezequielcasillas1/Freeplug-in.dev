import { intlLocale } from '@/i18n/format'
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
  return d.toLocaleDateString(intlLocale(locale), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Activity label for a billing_ledger row, built only from columns that exist in every
 * environment (amount_cents, created_at): "Payment of $35.00 on Oct 3, 2026".
 */
export function paymentActivityLabel(amountCents: number | null | undefined, createdAt: string | null | undefined): string {
  const amount =
    typeof amountCents === 'number' && Number.isFinite(amountCents)
      ? `$${(amountCents / 100).toFixed(2)}`
      : null
  const date = createdAt ? new Date(createdAt) : null
  const day = date && !Number.isNaN(date.getTime()) ? formatLedgerDate(date) : null
  if (amount && day) return `Payment of ${amount} on ${day}`
  if (amount) return `Payment of ${amount}`
  if (day) return `Payment on ${day}`
  return 'Payment'
}
