import { describe, expect, it } from 'vitest'
import * as priority from './priority'
import { PRIORITY_HELP_ANSWER, PRIORITY_MIN_MONTHLY_CENTS } from './priority'
import { stepById } from './ladder'

describe('Priority comes from the step, not the amount paid', () => {
  it('the threshold constant is the Priority step price (copy only)', () => {
    expect(PRIORITY_MIN_MONTHLY_CENTS).toBe(stepById('priority').monthlyCents)
  })

  it('the total-based helpers are gone (a tip must never buy Priority)', () => {
    const mod = priority as Record<string, unknown>
    for (const name of ['qualifiesForPriority', 'priorityRankForMonthlyCents', 'planMonthlyTotalCents', 'monthlyCents']) {
      expect(mod[name], name).toBeUndefined()
    }
  })

  it('help answer states the same threshold as the constant', () => {
    expect(PRIORITY_HELP_ANSWER).toContain(`$${PRIORITY_MIN_MONTHLY_CENTS / 100} a month`)
  })
})
