import { describe, expect, it } from 'vitest'
import { classifyChangeBilling, sizeOfChangeType } from './billing'
import { CHANGE_TYPES } from '@/lib/help/help-chat-content'

const plan = (included: number, big: number, step: string | null = 'starter', addons: ('small_edit' | 'big_change')[] = []) => ({
  step: step ? ({ id: step } as never) : null,
  legacy: false,
  includedEditsPerMonth: included,
  bigChangesPerMonth: big,
  addons,
})

describe('sizeOfChangeType', () => {
  it('the three named chat choices are small edits; "Something else" is unknown', () => {
    expect(CHANGE_TYPES.map(sizeOfChangeType)).toEqual(['small', 'small', 'small', null])
  })
})

describe('classifyChangeBilling', () => {
  it('included when a small-edit use is left this period (plan step or +1 small edit add-on)', () => {
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(1, 0), smallEditsUsed: 0, bigChangesUsed: 0 })).toBe('included')
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(2, 0), smallEditsUsed: 1, bigChangesUsed: 0 })).toBe('included')
  })
  it('paid_addon when no use is left and they do not have the matching add-on', () => {
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(1, 0), smallEditsUsed: 1, bigChangesUsed: 0 })).toBe('paid_addon')
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(0, 0), smallEditsUsed: 0, bigChangesUsed: 0 })).toBe('paid_addon')
    // Has the Big change add-on, but this is a small edit: the small-edit add-on is still the paid route.
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(1, 1, 'starter', ['big_change']), smallEditsUsed: 1, bigChangesUsed: 0 })).toBe('paid_addon')
  })
  it('ruling 4: never paid_addon when they already have that add-on (used up -> unknown)', () => {
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(2, 0, 'starter', ['small_edit']), smallEditsUsed: 2, bigChangesUsed: 0 })).toBe('unknown')
    expect(classifyChangeBilling({ size: 'big', entitlements: plan(0, 1, 'starter', ['big_change']), smallEditsUsed: 0, bigChangesUsed: 1 })).toBe('unknown')
  })
  it('ruling 4: included while the allowance is unused, add-on or not', () => {
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(2, 0, 'starter', ['small_edit']), smallEditsUsed: 1, bigChangesUsed: 0 })).toBe('included')
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(1, 0), smallEditsUsed: 0, bigChangesUsed: 0 })).toBe('included')
  })
  it('Big change uses its own count', () => {
    expect(classifyChangeBilling({ size: 'big', entitlements: plan(0, 1, 'starter', ['big_change']), smallEditsUsed: 5, bigChangesUsed: 0 })).toBe('included')
    expect(classifyChangeBilling({ size: 'big', entitlements: plan(2, 0), smallEditsUsed: 0, bigChangesUsed: 1 })).toBe('paid_addon')
  })
  it('quote when over an hour, whatever the plan', () => {
    expect(classifyChangeBilling({ size: 'over_hour', entitlements: plan(2, 1), smallEditsUsed: 0, bigChangesUsed: 0 })).toBe('quote')
    expect(classifyChangeBilling({ size: 'over_hour', entitlements: null, smallEditsUsed: null, bigChangesUsed: null })).toBe('quote')
  })
  it('unknown when it cannot tell: no plan, unknown size, or unknown usage', () => {
    expect(classifyChangeBilling({ size: 'small', entitlements: null, smallEditsUsed: 0, bigChangesUsed: 0 })).toBe('unknown')
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(1, 0, null), smallEditsUsed: 0, bigChangesUsed: 0 })).toBe('unknown')
    expect(classifyChangeBilling({ size: null, entitlements: plan(1, 0), smallEditsUsed: 0, bigChangesUsed: 0 })).toBe('unknown')
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(1, 0), smallEditsUsed: null, bigChangesUsed: 0 })).toBe('unknown')
    expect(classifyChangeBilling({ size: 'small', entitlements: { ...plan(1, 0), addons: undefined as never }, smallEditsUsed: 1, bigChangesUsed: 0 })).toBe('unknown')
  })
})
