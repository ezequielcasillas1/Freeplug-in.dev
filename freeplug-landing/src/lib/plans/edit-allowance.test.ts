import { describe, expect, it } from 'vitest'
import { EDIT_PACK_EDITS, PLAN_EDITS, editsIncluded, monthlyEditAllowance } from './edit-allowance'
import { editPackLine, editsIncludedLine, needMoreEditsLine, PLAN_EDIT_EXPLANATIONS } from './edits-copy'
import { entitlementsFor, withAddons } from './ladder'
import { classifyChangeBilling } from '@/lib/change-requests/billing'

describe('edit counts per plan (Oct 17 FINAL table)', () => {
  const table: [keyof typeof PLAN_EDITS, number | 'unlimited', number][] = [
    ['starter', 2, 5],
    ['priority', 5, 8],
    ['fast_lane', 10, 20],
    ['leads', 35, 45],
    ['get_found', 50, 70],
    ['growth', 'unlimited', 0],
  ]
  it.each(table)('%s: %s edits, with pack %s', (step, plan, withPack) => {
    expect(PLAN_EDITS[step]).toBe(plan)
    if (plan === 'unlimited') {
      expect(editsIncluded({ stepId: step, hasEditPack: false, used: 99 })).toEqual({ unlimited: true })
      expect(editsIncluded({ stepId: step, hasEditPack: true, used: 0 })).toEqual({ unlimited: true })
      expect(EDIT_PACK_EDITS[step]).toBe(0)
      expect(editsIncludedLine({ unlimited: true })).toBe('Unlimited edits')
      return
    }
    expect(editsIncluded({ stepId: step, hasEditPack: false, used: 0 })).toMatchObject({ total: plan, remaining: plan })
    expect(editsIncluded({ stepId: step, hasEditPack: true, used: 1 })).toMatchObject({ total: withPack, remaining: withPack - 1 })
    expect(editsIncluded({ stepId: step, hasEditPack: false, used: 999 })).toMatchObject({ remaining: 0 })
    expect(entitlementsFor({ stepId: step }).includedEditsPerMonth).toBe(plan)
  })
  it('max one pack a month, no rollover input', () => {
    expect(monthlyEditAllowance('starter', 3)).toBe(5)
    expect(monthlyEditAllowance('growth')).toBe(Number.POSITIVE_INFINITY)
  })
  it('retired add-ons grant nothing', () => {
    const e = withAddons(entitlementsFor({ stepId: 'starter' }), ['small_edit', 'big_change'])
    expect(e.includedEditsPerMonth).toBe(2)
    expect(e.bigChangesPerMonth).toBe(0)
  })
  it('copy: plan explanations, pack lines, need-more line', () => {
    expect(PLAN_EDIT_EXPLANATIONS.priority).toBe('5 edits a month: small changes like hours, a photo swap or a price change. Your requests go first in line.')
    expect(editPackLine('starter')).toBe("Edit pack: +3 small edits for $5/mo. One pack a month. Unused edits don't carry over.")
    expect(editPackLine('fast_lane')).toContain('+10 small edits')
    expect(editPackLine('growth')).toBeNull()
    expect(needMoreEditsLine('starter')).toBe('Need more edits this month? Add the $5 edit pack for 3 more.')
  })
  it('billing: edits left -> included, none left -> edit pack route, bigger work -> quote, unlimited -> included', () => {
    const ent = entitlementsFor({ stepId: 'starter' })
    expect(classifyChangeBilling({ size: 'small', entitlements: ent, smallEditsUsed: 1 })).toBe('included')
    expect(classifyChangeBilling({ size: 'small', entitlements: ent, smallEditsUsed: 2 })).toBe('paid_addon')
    expect(classifyChangeBilling({ size: 'big', entitlements: ent, smallEditsUsed: 0 })).toBe('quote')
    expect(classifyChangeBilling({ size: 'small', entitlements: entitlementsFor({ stepId: 'growth' }), smallEditsUsed: 500 })).toBe('included')
  })
})
