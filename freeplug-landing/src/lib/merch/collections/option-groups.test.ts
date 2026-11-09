import { describe, expect, it } from 'vitest'
import { getCatalogProduct } from './catalog'
import { planSplitOptions, resolveSplitOptionKey } from './option-groups'

describe('split option planning', () => {
  it('kjv woven blanket is style + size', () => {
    const entry = getCatalogProduct('kjv-woven-blanket')!
    const plan = planSplitOptions(entry)
    expect(plan).not.toBeNull()
    expect(plan!.dim1Kind).toBe('style')
    expect(plan!.dim1Values).toEqual(expect.arrayContaining(['Artwork', 'Photo']))
    const opt = entry.options.find((o) => o.label?.startsWith('Photo / 60'))
    expect(opt).toBeTruthy()
    const parts = opt!.label!.split(' / ')
    expect(resolveSplitOptionKey(plan!, parts[0]!, parts[1]!)).toBe(opt!.key)
  })

  it('stay-charged pullover is color then size', () => {
    const entry = getCatalogProduct('stay-charged-pullover')!
    const plan = planSplitOptions(entry)
    expect(plan?.dim1Kind).toBe('color')
    expect(plan?.dim2Kind).toBe('size')
  })
})
