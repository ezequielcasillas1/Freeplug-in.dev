import { describe, expect, it } from 'vitest'
import { subscriptionEndingMessage } from './subscription-alerts'

describe('subscriptionEndingMessage', () => {
  it('counts days when the end date is known', () => {
    expect(subscriptionEndingMessage('Hosting plan (monthly)', 1)).toBe(
      'Your Hosting plan (monthly) will end in 1 day. Resume to keep your website live.'
    )
    expect(subscriptionEndingMessage('Hosting plan (monthly)', 12)).toContain('in 12 days')
  })
  it('never shows NaN when the end date is missing', () => {
    const msg = subscriptionEndingMessage('Hosting plan (monthly)', null)
    expect(msg).toBe(
      'Your Hosting plan (monthly) will end at the end of the current billing period. Resume to keep your website live.'
    )
    expect(msg).not.toContain('NaN')
  })
})
