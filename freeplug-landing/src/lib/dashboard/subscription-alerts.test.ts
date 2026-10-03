import { describe, expect, it } from 'vitest'
import { RESUME_PLAN_ANCHOR_HREF, subscriptionEndingMessage } from './subscription-alerts'

describe('subscriptionEndingMessage (plan name only: Sable 5:11 PM, Vera B3)', () => {
  it('counts days when the end date is known: "Fast lane will end in 31 days."', () => {
    expect(subscriptionEndingMessage('Fast lane', 31)).toBe('Fast lane will end in 31 days. Resume to keep your website live.')
    expect(subscriptionEndingMessage('Starter', 1)).toBe('Starter will end in 1 day. Resume to keep your website live.')
    expect(subscriptionEndingMessage('Fast lane', 31)).not.toMatch(/tip/i)
  })
  it('never shows NaN when the end date is missing', () => {
    const msg = subscriptionEndingMessage('Fast lane', null)
    expect(msg).toBe('Fast lane will end at the end of the current billing period. Resume to keep your website live.')
    expect(msg).not.toContain('NaN')
  })
  it('"Resume plan" goes to the cancel page Resume box, not the Plans page (which has no Resume)', () => {
    expect(RESUME_PLAN_ANCHOR_HREF).toBe('/dashboard/cancel#resume-plan')
  })
})
