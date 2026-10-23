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

/** Columns read from billing_activity (migration 20261023120000) for Recent activity. */
export const REFUND_ACTIVITY_COLUMNS = 'id, created_at, amount_cents, reason, credit_choice'

/**
 * "Refund of $50.00 on Oct 23, 2026" + where it went for a downgrade: "... added toward your buyout" or
 * "... added to your Freeplug wallet".
 */
export function refundActivityLabel(
  amountCents: number | null | undefined,
  createdAt: string | null | undefined,
  reason: string | null | undefined,
  locale: AppLocale = 'en',
  t: Translate = translatorFor(locale),
  choice: string | null = null
): string {
  const amount = typeof amountCents === 'number' && Number.isFinite(amountCents) ? formatUsdIn(locale, Math.abs(amountCents), 2) : null
  const date = createdAt ? new Date(createdAt) : null
  const day = date && !Number.isNaN(date.getTime()) ? formatLedgerDate(date, locale) : null
  const base = amount && day ? t('dashboard.home.refund.amountOnDate', { amount, date: day }) : amount ? t('dashboard.home.refund.amount', { amount }) : t('dashboard.home.refund.plain')
  if (reason !== 'downgrade') return base
  if (choice === 'wallet') return t('dashboard.home.refund.toWallet', { line: base })
  if (choice === 'buyout') return t('dashboard.home.refund.toBuyout', { line: base })
  return t('dashboard.home.refund.downgrade', { line: base })
}

export type RefundActivityRow = {
  activity_key: string
  profile_id: string
  kind: 'refund'
  reason: 'downgrade' | 'other'
  amount_cents: number
  credit_choice: 'buyout' | 'wallet'
  stripe_balance_txn_id: string | null
  stripe_invoice_id: string | null
}

/** The billing_activity row for a $100 -> $35 downgrade refund; keyed per subscription+invoice (same as the Stripe idempotency key). */
export function downgradeRefundActivityRow(o: { subscriptionId: string; userId: string | null; invoiceId: string; refundId: string | null; refundCents: number; choice: 'buyout' | 'wallet' }): RefundActivityRow | null {
  if (!o.userId || !(o.refundCents > 0)) return null
  return {
    activity_key: `downgrade-refund:${o.subscriptionId}:${o.invoiceId}`,
    profile_id: o.userId,
    kind: 'refund',
    reason: 'downgrade',
    amount_cents: o.refundCents,
    credit_choice: o.choice,
    stripe_balance_txn_id: o.choice === 'wallet' ? o.refundId : null,
    stripe_invoice_id: o.invoiceId,
  }
}
