import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import {
  ACCESS_OFFLINE_MESSAGE,
  adminAccessLabel,
  computeWebsiteAccess,
  fillAccessTemplate,
  CANCEL_ACCESS_WARNING,
  CANCEL_RESUME_UNTIL_TEXT,
  CANCEL_OFFLINE_SAVED_TEXT,
  CANCEL_OFFLINE_HEADING,
  CANCEL_RESUME_HEADING,
  RESTART_HOSTING_LABEL,
  toAccessSubscription,
  websiteAccessAlert,
  type AccessSubscription,
} from './website-access'

const NOW = new Date('2026-09-25T12:00:00Z')
const PERIOD_END = new Date('2026-10-25T00:00:00Z')

function sub(over: Partial<AccessSubscription> = {}): AccessSubscription {
  return {
    status: 'active',
    cancelAtPeriodEnd: false,
    cancelAt: null,
    currentPeriodEnd: PERIOD_END,
    ...over,
  }
}

describe('computeWebsiteAccess', () => {
  it('active subscription with no cancel is active', () => {
    expect(computeWebsiteAccess([sub()], NOW)).toEqual({
      status: 'active',
      accessEndsAt: null,
      hasHostingHistory: true,
    })
  })

  it('(b) cancel keeps access until current_period_end, not the moment Cancel is clicked', () => {
    const canceled = sub({ cancelAtPeriodEnd: true })
    const justAfterClick = computeWebsiteAccess([canceled], NOW)
    expect(justAfterClick.status).toBe('ending')
    expect(justAfterClick.accessEndsAt).toEqual(PERIOD_END)
    // One second before the period end: still online.
    expect(computeWebsiteAccess([canceled], new Date(PERIOD_END.getTime() - 1000)).status).toBe('ending')
    // Stripe ends it at the period end: offline.
    expect(computeWebsiteAccess([sub({ status: 'canceled', cancelAtPeriodEnd: true })], PERIOD_END).status).toBe(
      'offline'
    )
    // Even if the status hasn't flipped yet, access is off once the period end has passed.
    expect(computeWebsiteAccess([canceled], new Date(PERIOD_END.getTime() + 1000)).status).toBe('offline')
  })

  it('uses cancel_at when Stripe schedules the end with it', () => {
    const at = new Date('2026-10-10T00:00:00Z')
    const r = computeWebsiteAccess([sub({ cancelAt: at })], NOW)
    expect(r).toMatchObject({ status: 'ending', accessEndsAt: at })
  })

  it('(c) cancel then resume before the period ends is active (never ending or offline)', () => {
    // Resume = Stripe clears cancel_at_period_end on the same subscription.
    expect(computeWebsiteAccess([sub({ cancelAtPeriodEnd: false })], NOW).status).toBe('active')
    // Ended plan plus a new live plan (re-signup) is active too.
    expect(
      computeWebsiteAccess([sub({ status: 'canceled', cancelAtPeriodEnd: true }), sub()], NOW).status
    ).toBe('active')
  })

  it.each(['past_due', 'unpaid'])('(d) a failed payment (%s) keeps the site active', (status) => {
    expect(computeWebsiteAccess([sub({ status })], NOW).status).toBe('active')
  })

  it('offline when nothing is live; no history for a customer who never had hosting', () => {
    expect(computeWebsiteAccess([sub({ status: 'canceled' })], NOW)).toEqual({
      status: 'offline',
      accessEndsAt: null,
      hasHostingHistory: true,
    })
    expect(computeWebsiteAccess([], NOW).hasHostingHistory).toBe(false)
    expect(computeWebsiteAccess([sub({ status: 'incomplete_expired' })], NOW).hasHostingHistory).toBe(false)
  })

  it('reads Stripe subscriptions with the period end on the items', () => {
    const s = {
      id: 'sub_1',
      status: 'active',
      cancel_at_period_end: true,
      cancel_at: null,
      items: { data: [{ current_period_end: PERIOD_END.getTime() / 1000 }] },
    } as unknown as Stripe.Subscription
    expect(computeWebsiteAccess([toAccessSubscription(s)], NOW)).toMatchObject({
      status: 'ending',
      accessEndsAt: PERIOD_END,
    })
  })
})

describe('websiteAccessAlert (one button, by state)', () => {
  it('ending: Sable message with the date and only "Resume plan"', () => {
    const a = websiteAccessAlert({ status: 'ending', accessEndsAt: PERIOD_END, hasHostingHistory: true })!
    expect(`${a.before}${a.date}${a.after}`).toBe(
      'Your hosting is canceled. Your website stays online until Oct 25, 2026, then goes offline. Resume your plan before then to keep it online.'
    )
    expect(a.date).toBe('Oct 25, 2026')
    expect(a.button).toEqual({ kind: 'resume', label: 'Resume plan' })
  })

  it('offline: Sable message and only "Restart hosting" to checkout', () => {
    const a = websiteAccessAlert({ status: 'offline', accessEndsAt: null, hasHostingHistory: true })!
    expect(a.before).toBe(ACCESS_OFFLINE_MESSAGE)
    expect(a.date).toBeNull()
    expect(a.button).toEqual({ kind: 'checkout', label: 'Restart hosting', href: '/dashboard/plans' })
  })

  it('no alert while active, for customers who never had hosting, or when unknown', () => {
    expect(websiteAccessAlert({ status: 'active', accessEndsAt: null, hasHostingHistory: true })).toBeNull()
    expect(websiteAccessAlert({ status: 'offline', accessEndsAt: null, hasHostingHistory: false })).toBeNull()
    expect(websiteAccessAlert(null)).toBeNull()
  })
})

describe('copy helpers', () => {
  it('cancel warning uses the fixed date format', () => {
    expect(fillAccessTemplate(CANCEL_ACCESS_WARNING, PERIOD_END)).toBe(
      'If you cancel, your website stays online until Oct 25, 2026 and then goes offline. You can bring it back by signing up for hosting again.'
    )
  })
  it('cancel page resume box text', () => {
    expect(fillAccessTemplate(CANCEL_RESUME_UNTIL_TEXT, PERIOD_END)).toBe(
      'You can resume your plan until Oct 25, 2026. After that, your website is saved, and you can bring it back by signing up for hosting again.'
    )
    expect(CANCEL_OFFLINE_SAVED_TEXT).toBe(
      'Your website is saved, and you can bring it back by signing up for hosting again.'
    )
  })
  it('cancel page resume box headings: offline says "Bring your website back" (Vera, Sable)', () => {
    expect(CANCEL_OFFLINE_HEADING).toBe('Bring your website back')
    expect(CANCEL_RESUME_HEADING).toBe('Ready to resume?')
    expect(RESTART_HOSTING_LABEL).toBe('Restart hosting')
  })
  it('admin labels', () => {
    expect(adminAccessLabel({ status: 'active', accessEndsAt: null, hasHostingHistory: true })).toBe('Website active')
    expect(adminAccessLabel({ status: 'ending', accessEndsAt: PERIOD_END, hasHostingHistory: true })).toBe(
      'Website active until Oct 25, 2026'
    )
    expect(adminAccessLabel({ status: 'offline', accessEndsAt: null, hasHostingHistory: true })).toBe(
      'Website offline (hosting canceled)'
    )
  })
})
