import type Stripe from 'stripe'

/**
 * Stripe billing dates.
 *
 * Root cause of the "Invalid Date" bug (Sep 25, 2026): since Stripe API 2025-03-31 ("basil"), and
 * so in the version pinned by stripe@21 ("2026-03-25.dahlia"), `current_period_start` and
 * `current_period_end` live on each subscription ITEM, not on the subscription. The dashboard and
 * cancel page read `sub.current_period_end`, got `undefined`, and `new Date(undefined * 1000)` is an
 * Invalid Date. These helpers read the item fields (with the old subscription field as a fallback)
 * and return null instead of an Invalid Date, so the UI can show a fallback.
 */

/** Shown wherever a billing date is missing. */
export const BILLING_DATE_FALLBACK = 'Date not available'

type WithLegacyPeriod = Stripe.Subscription & {
  current_period_end?: number | null
  current_period_start?: number | null
}

/**
 * Converts a Stripe timestamp to a Date. Stripe sends Unix seconds; this also accepts
 * milliseconds, numeric strings, ISO strings and Dates. Returns null for anything missing/invalid.
 */
export function stripeTimestampToDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  let ms: number
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim()))) {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) return null
    // Unix seconds are ~1.7e9 today; anything above 1e12 is already milliseconds.
    ms = n > 1e12 ? n : n * 1000
  } else if (typeof value === 'string') {
    ms = Date.parse(value)
  } else {
    return null
  }
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d
}

function pickItemTimestamps(
  sub: Stripe.Subscription,
  key: 'current_period_end' | 'current_period_start'
): number[] {
  return (sub.items?.data ?? [])
    .map((i) => (i as unknown as Record<string, unknown>)[key])
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
}

/** End of the current billing period (latest item end; legacy subscription field as fallback). */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const ends = pickItemTimestamps(sub, 'current_period_end')
  if (ends.length > 0) return stripeTimestampToDate(Math.max(...ends))
  return stripeTimestampToDate((sub as WithLegacyPeriod).current_period_end)
}

/** Start of the current billing period (earliest item start; legacy field as fallback). */
export function subscriptionPeriodStart(sub: Stripe.Subscription): Date | null {
  const starts = pickItemTimestamps(sub, 'current_period_start')
  if (starts.length > 0) return stripeTimestampToDate(Math.min(...starts))
  return stripeTimestampToDate((sub as WithLegacyPeriod).current_period_start)
}

/**
 * Formats a billing date as "Oct 25, 2026" (UTC, like formatPlanEndDate, so server and client
 * agree). Missing or invalid dates return the fallback instead of "Invalid Date".
 */
export function formatBillingDate(
  date: Date | null | undefined,
  fallback: string = BILLING_DATE_FALLBACK
): string {
  if (!date || Number.isNaN(date.getTime())) return fallback
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Whole days from now until `date` (rounded up), or null when the date is missing. */
export function daysUntil(date: Date | null | undefined, now: number = Date.now()): number | null {
  if (!date || Number.isNaN(date.getTime())) return null
  return Math.ceil((date.getTime() - now) / (1000 * 60 * 60 * 24))
}
