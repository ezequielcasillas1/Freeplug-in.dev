import { describe, expect, it } from 'vitest'
import { RESUME_PLAN_ANCHOR_HREF, grandfatheredAlertName, subscriptionEndingMessage } from './subscription-alerts'

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
  it('Sable 5:30 PM: a grandfathered plan drops "(monthly)", joins with "and", no extra "plan"', () => {
    expect(subscriptionEndingMessage('Hosting plan (monthly) + Pro add-on (monthly)', 12)).toBe(
      'Your hosting plan and Pro add-on will end in 12 days. Resume to keep your website live.'
    )
    expect(subscriptionEndingMessage('Hosting plan (monthly) + Pro add-on (monthly)', null)).toBe(
      'Your hosting plan and Pro add-on will end at the end of the current billing period. Resume to keep your website live.'
    )
    expect(subscriptionEndingMessage('Hosting plan (monthly) + Pro add-on (monthly)', 12)).not.toMatch(/monthly|\+/)
  })
  it('grandfatheredAlertName: one item, three items, names that must keep their capitals', () => {
    expect(grandfatheredAlertName('Hosting plan (monthly)')).toBe('hosting plan')
    expect(grandfatheredAlertName('Hosting plan (monthly) + Pro add-on (monthly) + Backups (yearly)')).toBe('hosting plan, Pro add-on and Backups')
    expect(grandfatheredAlertName('WordPress hosting (monthly) + SEO pack')).toBe('WordPress hosting and SEO pack')
  })
  it('"Resume plan" goes to the cancel page Resume box, not the Plans page (which has no Resume)', () => {
    expect(RESUME_PLAN_ANCHOR_HREF).toBe('/dashboard/cancel#resume-plan')
  })
})
