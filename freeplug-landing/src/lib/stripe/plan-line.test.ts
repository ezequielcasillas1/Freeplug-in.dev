import { describe, expect, it } from 'vitest'
import { formatPlanDollars, planDisplayName, planNameOf, planStripLine, subscriptionListName } from './plan-line'
import { PLAN_STEPS } from '../plans/ladder'

const ladder = (step: string, cents: number) => ({ lookupKey: `freeplug_step_${step}_monthly`, productName: `Freeplug Hosting: ${step}`, unitAmountCents: cents, quantity: 1 })

describe('Plans page strip line (round 5)', () => {
  it('a ladder plan: step name, whole dollars, no product prefix (no double colon)', () => {
    const line = planStripLine([ladder('fast_lane', 6500)], 'month', 'active')
    expect(line).toBe('Fast lane · $65/month')
    expect(`Current plan: ${line}`.match(/:/g)).toHaveLength(1)
  })
  it('cents only when they are not zero', () => {
    expect(formatPlanDollars(6500)).toBe('$65')
    expect(formatPlanDollars(6550)).toBe('$65.50')
    expect(formatPlanDollars(0)).toBe('$0')
  })
  it('a grandfathered plan uses the short name (Sable 6:28 PM); a non-active status is shown', () => {
    const items = [
      { lookupKey: null, productName: 'Hosting plan (monthly)', unitAmountCents: 4000, quantity: 1 },
      { lookupKey: null, productName: 'Pro add-on (monthly)', unitAmountCents: 1500, quantity: 1 },
    ]
    expect(planStripLine(items, 'month', 'past_due')).toBe('Hosting + Pro add-on · $55/month (past due)')
  })
})

describe('plan names on the dashboard (Sable 5:11 PM)', () => {
  it('planNameOf: the step name for a ladder plan, product names for a grandfathered one (never the tip)', () => {
    expect(planNameOf([ladder('fast_lane', 6500)])).toBe('Fast lane')
    expect(planNameOf([{ lookupKey: null, productName: 'Hosting plan (monthly)' }, { lookupKey: null, productName: 'Pro add-on (monthly)' }])).toBe('Hosting plan (monthly) + Pro add-on (monthly)')
  })
  it('Active Subscriptions list: "Fast lane + $4 tip" (PLAN_STRIP_TIP pattern); plan name only without a tip', () => {
    expect(subscriptionListName('Fast lane', 4)).toBe('Fast lane + $4 tip')
    expect(subscriptionListName('Fast lane', 0)).toBe('Fast lane')
  })
})

describe('grandfathered display name (Sable 6:19 PM; Vera copy-c4f9940 lows)', () => {
  const hosting = { lookupKey: null, productName: 'Hosting plan (monthly)', productId: 'prod_hosting' }
  const pro = { lookupKey: null, productName: 'Pro add-on (monthly)', productId: 'prod_x' }
  it('no add-on: "Hosting plan"', () => {
    expect(planDisplayName([hosting])).toBe('Hosting plan')
    expect(subscriptionListName(planDisplayName([hosting]), 0)).toBe('Hosting plan')
  })
  it('with the Pro add-on: "Hosting + Pro add-on", whatever the item order', () => {
    expect(planDisplayName([hosting, pro])).toBe('Hosting + Pro add-on')
    expect(planDisplayName([pro, hosting])).toBe('Hosting + Pro add-on')
    // the add-on product by id (freeplug_addon_<tier>_monthly), whatever its name
    expect(planDisplayName([hosting, { lookupKey: null, productName: 'Old add-on', productId: 'freeplug_addon_plus_monthly' }])).toBe('Hosting + Plus add-on')
  })
  it('add-on with a tip: "Hosting + Pro add-on + $4 tip" (the real tip amount)', () => {
    expect(subscriptionListName(planDisplayName([hosting, pro]), 4)).toBe('Hosting + Pro add-on + $4 tip')
    expect(subscriptionListName(planDisplayName([hosting, pro]), 11)).toBe('Hosting + Pro add-on + $11 tip')
  })
  it('a $0 tip adds nothing', () => {
    expect(subscriptionListName(planDisplayName([hosting, pro]), 0)).toBe('Hosting + Pro add-on')
    expect(subscriptionListName(planDisplayName([hosting]), 0)).toBe('Hosting plan')
  })
  it('a ladder plan is still its step name; planNameOf (the ending alert source) is unchanged', () => {
    expect(planDisplayName([ladder('fast_lane', 6500)])).toBe('Fast lane')
    expect(planNameOf([hosting, pro])).toBe('Hosting plan (monthly) + Pro add-on (monthly)')
  })
})

describe('Plans page "Current plan" line, grandfathered short name without the tip (Sable 6:28 PM)', () => {
  const hosting = { lookupKey: null, productName: 'Hosting plan (monthly)', productId: 'prod_h', unitAmountCents: 4000, quantity: 1 }
  const pro = { lookupKey: null, productName: 'Pro add-on (monthly)', productId: 'prod_p', unitAmountCents: 1000, quantity: 1 }
  it('no add-on: "Hosting plan · $40/month"', () => {
    expect(planStripLine([hosting], 'month', 'active')).toBe('Hosting plan · $40/month')
  })
  it('add-on: "Hosting + Pro add-on · $50/month"', () => {
    expect(planStripLine([hosting, pro], 'month', 'active')).toBe('Hosting + Pro add-on · $50/month')
    expect(planStripLine([pro, hosting], 'month', 'active')).toBe('Hosting + Pro add-on · $50/month')
  })
  it('add-on with a $4 tip: the tip is not shown (name or line)', () => {
    const line = planStripLine([hosting, pro], 'month', 'active', 4)
    expect(line).toBe('Hosting + Pro add-on · $50/month')
    expect(line).not.toMatch(/tip|\$4\b|\$54/)
    expect(planStripLine([hosting], 'month', 'active', 4)).toBe('Hosting plan · $40/month')
  })
  it('ladder plans come out unchanged (step name, tip part kept)', () => {
    for (const step of PLAN_STEPS) {
      const item = { lookupKey: step.lookupKey, productName: `Freeplug Hosting: ${step.name}`, unitAmountCents: step.monthlyCents, quantity: 1 }
      expect(planDisplayName([item])).toBe(planNameOf([item]))
      expect(planDisplayName([item])).toBe(step.name)
      expect(planStripLine([item], 'month', 'active', 3)).toBe(`${step.name} · ${formatPlanDollars(step.monthlyCents)}/month + $3 tip`)
    }
    expect(planStripLine([ladder('fast_lane', 6500)], 'month', 'active')).toBe('Fast lane · $65/month')
    expect(planStripLine([ladder('fast_lane', 6500)], 'month', 'active', 6)).toBe('Fast lane · $65/month + $6 tip')
    expect(planStripLine([ladder('priority', 5500)], 'month', 'past_due', 4)).toBe('Priority · $55/month + $4 tip (past due)')
  })
})

describe('add-ons in the strip and list names (Oct 4)', () => {
  it('a ladder plan shows add-ons as their own part, before the tip', () => {
    expect(planStripLine([ladder('starter', 3500)], 'month', 'active', 4, 1075)).toBe('Starter · $35/month + $10.75 add-ons + $4 tip')
    expect(planStripLine([ladder('priority', 5500)], 'month', 'active', 0, 575)).toBe('Priority · $55/month + $5.75 add-ons')
    expect(subscriptionListName('Fast lane', 0, 500)).toBe('Fast lane + $5 add-ons')
    expect(subscriptionListName('Fast lane', 3, 500)).toBe('Fast lane + $5 add-ons + $3 tip')
  })
})
