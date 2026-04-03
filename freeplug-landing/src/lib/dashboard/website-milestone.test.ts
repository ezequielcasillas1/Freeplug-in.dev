import { describe, expect, it } from 'vitest'
import { milestoneWebsiteValueReached } from './website-milestone'

describe('milestoneWebsiteValueReached', () => {
  it('is false when target is null or zero', () => {
    expect(milestoneWebsiteValueReached(null, 10_000)).toBe(false)
    expect(milestoneWebsiteValueReached(0, 10_000)).toBe(false)
    expect(milestoneWebsiteValueReached(undefined, 10_000)).toBe(false)
  })

  it('is true when paid equals target', () => {
    expect(milestoneWebsiteValueReached(50_000, 50_000)).toBe(true)
  })

  it('is true when paid exceeds target', () => {
    expect(milestoneWebsiteValueReached(50_000, 60_000)).toBe(true)
  })

  it('is false when paid is below target', () => {
    expect(milestoneWebsiteValueReached(50_000, 49_999)).toBe(false)
  })

  it('treats null/undefined paid as zero', () => {
    expect(milestoneWebsiteValueReached(100, null)).toBe(false)
    expect(milestoneWebsiteValueReached(100, undefined)).toBe(false)
  })
})

describe('invoice.paid cumulative vs milestone (dashboard contract)', () => {
  it('after webhook adds amount_paid, milestone can flip so handoff can show', () => {
    const targetCents = 50_000
    const prevCents = 40_000
    const invoiceAmountPaid = 15_000
    const nextCents = prevCents + invoiceAmountPaid
    expect(milestoneWebsiteValueReached(targetCents, prevCents)).toBe(false)
    expect(milestoneWebsiteValueReached(targetCents, nextCents)).toBe(true)
  })
})
