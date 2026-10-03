import { describe, expect, it } from 'vitest'
import {
  PRIORITY_HELP_ANSWER,
  PRIORITY_MIN_MONTHLY_CENTS,
  monthlyCents,
  planMonthlyTotalCents,
  qualifiesForPriority,
} from './priority'

describe('Priority threshold', () => {
  it('$55 shows Priority and $50 does not', () => {
    expect(qualifiesForPriority(5500)).toBe(true)
    expect(qualifiesForPriority(5000)).toBe(false)
    expect(qualifiesForPriority(5499)).toBe(false)
  })

  it('counts hosting plus add-on from active plans only', () => {
    // $40 hosting + $15 Pro add-on on one plan = $55
    expect(
      planMonthlyTotalCents([{ status: 'active', amount: 4000 + 1500, interval: 'month' }])
    ).toBe(5500)
    expect(
      qualifiesForPriority(
        planMonthlyTotalCents([{ status: 'active', amount: 3500 + 1500, interval: 'month' }])
      )
    ).toBe(false)
    expect(planMonthlyTotalCents([{ status: 'canceled', amount: 10000, interval: 'month' }])).toBe(
      0
    )
    expect(monthlyCents(66000, 'year')).toBe(5500)
  })

  it('help answer states the same threshold as the constant', () => {
    expect(PRIORITY_HELP_ANSWER).toContain(`$${PRIORITY_MIN_MONTHLY_CENTS / 100} a month`)
  })
})
