// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { daysSince, firstPaymentDate } from './customer-since'

const T = (iso: string) => Math.floor(Date.parse(iso) / 1000)
const FIRST = '2026-10-03T19:03:30Z'

describe('firstPaymentDate', () => {
  it('prefers the oldest ledger row', () => {
    expect(firstPaymentDate(FIRST, [{ start_date: T('2026-09-01T00:00:00Z') }])?.toISOString()).toBe('2026-10-03T19:03:30.000Z')
  })
  it('falls back to the earliest start_date ?? created', () => {
    const d = firstPaymentDate(null, [{ start_date: T('2026-10-20T00:00:00Z') }, { start_date: null, created: T(FIRST) }])
    expect(d?.toISOString()).toBe('2026-10-03T19:03:30.000Z')
  })
  it('the fallback skips incomplete, incomplete_expired and trialing subscriptions', () => {
    const early = T('2026-09-01T00:00:00Z')
    const d = firstPaymentDate(null, [
      { status: 'incomplete', start_date: early },
      { status: 'incomplete_expired', start_date: early },
      { status: 'trialing', start_date: early },
      { status: 'canceled', start_date: T(FIRST) },
    ])
    expect(d?.toISOString()).toBe('2026-10-03T19:03:30.000Z')
    expect(firstPaymentDate(null, [{ status: 'trialing', start_date: early }])).toBeNull()
  })
  it('ignores an unparseable ledger date and empty or zero starts', () => {
    expect(firstPaymentDate('not a date', [{ start_date: 0 }, {}])).toBeNull()
    expect(firstPaymentDate(undefined)).toBeNull()
  })
})

describe('daysSince (fixed clock around Nov 3, 2026)', () => {
  const first = new Date(FIRST)
  it.each([
    ['2026-10-03T23:00:00Z', 0],
    ['2026-11-03T20:00:00Z', 31],
    ['2026-11-04T20:00:00Z', 32],
    ['2026-12-04T20:00:00Z', 62],
  ])('%s -> %i', (now, days) => {
    expect(daysSince(first, new Date(now))).toBe(days)
  })
  it('never negative (clock skew)', () => {
    expect(daysSince(first, new Date('2026-10-03T19:00:00Z'))).toBe(0)
  })
})
