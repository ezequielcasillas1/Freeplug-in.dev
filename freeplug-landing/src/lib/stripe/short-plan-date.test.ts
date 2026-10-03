import { describe, expect, it } from 'vitest'
import { formatPlanEndDate, formatShortPlanDate } from './active-subscription'

// Lina, round 5b: the downgrade button says "Switch to Starter on Nov 3" (fits one line at 375); the
// year is added only when it isn't the current year. The hint lines keep formatPlanEndDate.
describe('formatShortPlanDate', () => {
  const now = new Date('2026-10-03T20:00:00Z')
  it('month abbreviation and day in the current year', () => {
    expect(formatShortPlanDate(new Date('2026-11-03T00:00:00Z'), now)).toBe('Nov 3')
    expect(formatShortPlanDate(new Date('2026-12-31T23:59:59Z'), now)).toBe('Dec 31')
  })
  it('adds the year when it is not the current year', () => {
    expect(formatShortPlanDate(new Date('2027-01-03T00:00:00Z'), now)).toBe('Jan 3, 2027')
  })
  it('UTC, like formatPlanEndDate (server and client agree)', () => {
    const d = new Date('2026-11-03T02:00:00Z') // still Nov 2 in Chicago
    expect(formatShortPlanDate(d, now)).toBe('Nov 3')
    expect(formatPlanEndDate(d)).toBe('November 3, 2026')
  })
})
