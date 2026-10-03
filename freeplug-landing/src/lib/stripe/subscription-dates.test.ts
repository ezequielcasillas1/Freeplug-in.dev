import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import {
  BILLING_DATE_FALLBACK,
  daysUntil,
  formatBillingDate,
  stripeTimestampToDate,
  subscriptionPeriodEnd,
  subscriptionPeriodStart,
} from './subscription-dates'

const OCT_25 = 1792886400 // 2026-10-25T00:00:00Z in Unix seconds

function sub(fields: Record<string, unknown>, items: Record<string, unknown>[] = []) {
  return { ...fields, items: { data: items } } as unknown as Stripe.Subscription
}

describe('stripeTimestampToDate', () => {
  it('reads Unix seconds', () => {
    expect(stripeTimestampToDate(OCT_25)?.toISOString()).toBe('2026-10-25T00:00:00.000Z')
  })
  it('reads milliseconds, numeric strings and ISO strings', () => {
    expect(stripeTimestampToDate(OCT_25 * 1000)?.toISOString()).toBe('2026-10-25T00:00:00.000Z')
    expect(stripeTimestampToDate(String(OCT_25))?.toISOString()).toBe('2026-10-25T00:00:00.000Z')
    expect(stripeTimestampToDate('2026-10-25T00:00:00Z')?.toISOString()).toBe(
      '2026-10-25T00:00:00.000Z'
    )
  })
  it('returns null (never an Invalid Date) for missing or bad values', () => {
    for (const v of [undefined, null, '', 0, NaN, 'not a date', {}]) {
      expect(stripeTimestampToDate(v)).toBeNull()
    }
  })
})

describe('subscriptionPeriodEnd / Start', () => {
  it('uses the item period (Stripe API 2025-03-31 and later)', () => {
    const s = sub({}, [{ current_period_end: OCT_25, current_period_start: OCT_25 - 2592000 }])
    expect(subscriptionPeriodEnd(s)?.toISOString()).toBe('2026-10-25T00:00:00.000Z')
    expect(subscriptionPeriodStart(s)?.toISOString()).toBe('2026-09-25T00:00:00.000Z')
  })
  it('takes the latest end across items (hosting + add-on)', () => {
    const s = sub({}, [{ current_period_end: OCT_25 - 10 }, { current_period_end: OCT_25 }])
    expect(subscriptionPeriodEnd(s)?.getTime()).toBe(OCT_25 * 1000)
  })
  it('falls back to the legacy subscription field', () => {
    expect(subscriptionPeriodEnd(sub({ current_period_end: OCT_25 }))?.getTime()).toBe(OCT_25 * 1000)
  })
  it('returns null when Stripe sends no period at all (the old Invalid Date case)', () => {
    expect(subscriptionPeriodEnd(sub({}, [{ id: 'si_1' }]))).toBeNull()
    expect(subscriptionPeriodStart(sub({ current_period_start: null }))).toBeNull()
  })
})

describe('formatBillingDate', () => {
  it('formats a date as "Oct 25, 2026"', () => {
    expect(formatBillingDate(new Date('2026-10-25T00:00:00Z'))).toBe('Oct 25, 2026')
  })
  it('shows the fallback instead of "Invalid Date"', () => {
    expect(formatBillingDate(null)).toBe(BILLING_DATE_FALLBACK)
    expect(formatBillingDate(new Date(NaN))).toBe(BILLING_DATE_FALLBACK)
    expect(formatBillingDate(undefined, '—')).toBe('—')
    expect(formatBillingDate(new Date(NaN))).not.toContain('Invalid')
  })
})

describe('daysUntil', () => {
  it('counts whole days and returns null for a missing date', () => {
    const now = Date.parse('2026-10-20T00:00:00Z')
    expect(daysUntil(new Date('2026-10-25T00:00:00Z'), now)).toBe(5)
    expect(daysUntil(null, now)).toBeNull()
    expect(daysUntil(new Date(NaN), now)).toBeNull()
  })
})
