import { describe, expect, it } from 'vitest'
import { classifyChangeBilling, sizeOfChangeType } from './billing'
import { CHANGE_TYPES } from '@/lib/help/help-chat-content'

const plan = (included: number, big: number, step: string | null = 'starter') => ({
  step: step ? ({ id: step } as never) : null,
  legacy: false,
  includedEditsPerMonth: included,
  bigChangesPerMonth: big,
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
  it('paid_addon when no use is left (or the plan has none)', () => {
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(1, 0), smallEditsUsed: 1, bigChangesUsed: 0 })).toBe('paid_addon')
    expect(classifyChangeBilling({ size: 'small', entitlements: plan(0, 0), smallEditsUsed: 0, bigChangesUsed: 0 })).toBe('paid_addon')
  })
  it('Big change uses its own count', () => {
    expect(classifyChangeBilling({ size: 'big', entitlements: plan(0, 1), smallEditsUsed: 5, bigChangesUsed: 0 })).toBe('included')
    expect(classifyChangeBilling({ size: 'big', entitlements: plan(2, 1), smallEditsUsed: 0, bigChangesUsed: 1 })).toBe('paid_addon')
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
  })
})
