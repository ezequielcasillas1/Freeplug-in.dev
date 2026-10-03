import { describe, expect, it } from 'vitest'
import { RESUME_PLAN_ANCHOR_HREF, subscriptionEndingMessage } from './subscription-alerts'

describe('subscriptionEndingMessage (Sable 5:23 PM: "Your Fast lane plan will end in 31 days.")', () => {
  it('a ladder step: "Your {plan name} plan will end in {n} days", no tip in it', () => {
    expect(subscriptionEndingMessage('Fast lane', 31, true)).toBe('Your Fast lane plan will end in 31 days. Resume to keep your website live.')
    expect(subscriptionEndingMessage('Starter', 1, true)).toBe('Your Starter plan will end in 1 day. Resume to keep your website live.')
    expect(subscriptionEndingMessage('Fast lane', 31, true)).not.toMatch(/tip/i)
  })
  it('never shows NaN when the end date is missing', () => {
    const msg = subscriptionEndingMessage('Fast lane', null, true)
    expect(msg).toBe('Your Fast lane plan will end at the end of the current billing period. Resume to keep your website live.')
    expect(msg).not.toContain('NaN')
  })
  it('a grandfathered plan keeps its product names, without an extra "plan"', () => {
    expect(subscriptionEndingMessage('Hosting plan (monthly) + Pro add-on (monthly)', 12)).toBe(
      'Your Hosting plan (monthly) + Pro add-on (monthly) will end in 12 days. Resume to keep your website live.'
    )
  })
  it('"Resume plan" goes to the cancel page Resume box, not the Plans page (which has no Resume)', () => {
    expect(RESUME_PLAN_ANCHOR_HREF).toBe('/dashboard/cancel#resume-plan')
  })
})
