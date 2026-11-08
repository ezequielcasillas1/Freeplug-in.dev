import { describe, expect, it } from 'vitest'
import { EDIT_PACK_EDITS, PLAN_EDITS, editsIncluded, monthlyEditAllowance } from './edit-allowance'
import { editPackLine, needMoreEditsLine, PLAN_EDIT_EXPLANATIONS } from './edits-copy'
import { entitlementsFor, withAddons } from './ladder'
import { classifyChangeBilling } from '@/lib/change-requests/billing'

describe('edit counts per plan (Nov 2026)', () => {
  const table: [keyof typeof PLAN_EDITS, number][] = [
    ['starter', 2],
    ['priority', 5],
    ['fast_lane', 7],
    ['leads', 12],
    ['get_found', 15],
    ['growth', 20],
    ['plug_authority', 25],
  ]
  it.each(table)('%s: %s edits', (step, plan) => {
    expect(PLAN_EDITS[step]).toBe(plan)
    expect(EDIT_PACK_EDITS[step]).toBe(0)
    expect(editsIncluded({ stepId: step, hasEditPack: false, used: 0 })).toMatchObject({ total: plan, remaining: plan })
    expect(editsIncluded({ stepId: step, hasEditPack: true, used: 0 })).toMatchObject({ total: plan })
    expect(entitlementsFor({ stepId: step }).includedEditsPerMonth).toBe(plan)
  })
  it('edit packs are not sold', () => {
    expect(editPackLine('starter')).toBeNull()
    expect(needMoreEditsLine('fast_lane')).toBeNull()
    expect(monthlyEditAllowance('starter', 1)).toBe(2)
  })
  it('retired add-ons grant nothing', () => {
    const e = withAddons(entitlementsFor({ stepId: 'starter' }), ['small_edit', 'big_change'])
    expect(e.includedEditsPerMonth).toBe(2)
    expect(e.bigChangesPerMonth).toBe(0)
  })
  it('plan explanations mention 5 business days and carry-over rule', () => {
    expect(PLAN_EDIT_EXPLANATIONS.fast_lane).toContain('7 edits a month')
    expect(PLAN_EDIT_EXPLANATIONS.fast_lane).toContain("Unused edits don't carry over.")
    expect(PLAN_EDIT_EXPLANATIONS.fast_lane).toContain('within 5 business days')
  })
  it('billing: edits left -> included, none left -> paid_addon, bigger work -> quote', () => {
    const ent = entitlementsFor({ stepId: 'starter' })
    expect(classifyChangeBilling({ size: 'small', entitlements: ent, smallEditsUsed: 1 })).toBe('included')
    expect(classifyChangeBilling({ size: 'small', entitlements: ent, smallEditsUsed: 2 })).toBe('paid_addon')
    expect(classifyChangeBilling({ size: 'big', entitlements: ent, smallEditsUsed: 0 })).toBe('quote')
    expect(classifyChangeBilling({ size: 'small', entitlements: entitlementsFor({ stepId: 'growth' }), smallEditsUsed: 19 })).toBe('included')
    expect(classifyChangeBilling({ size: 'small', entitlements: entitlementsFor({ stepId: 'growth' }), smallEditsUsed: 20 })).toBe('paid_addon')
  })
})
