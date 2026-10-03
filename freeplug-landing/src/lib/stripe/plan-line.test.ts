import { describe, expect, it } from 'vitest'
import { formatPlanDollars, planDisplayName, planNameOf, planStripLine, subscriptionListName } from './plan-line'

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
  it('a grandfathered plan keeps its product names; a non-active status is shown', () => {
    const items = [
      { lookupKey: null, productName: 'Hosting plan (monthly)', unitAmountCents: 4000, quantity: 1 },
      { lookupKey: null, productName: 'Pro add-on (monthly)', unitAmountCents: 1500, quantity: 1 },
    ]
    expect(planStripLine(items, 'month', 'past_due')).toBe('Hosting plan (monthly) + Pro add-on (monthly) · $55/month (past due)')
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
