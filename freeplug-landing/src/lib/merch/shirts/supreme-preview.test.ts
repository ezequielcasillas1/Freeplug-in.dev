import { describe, expect, it } from 'vitest'
import { WORDMARK_VARIATIONS } from '@/lib/merch/preview/wordmark-variations'
import {
  getSupremePreviewSpec,
  isSupremeStyleShirtSlug,
  listSupremePreviewSpecs,
  supremeWordmarkVisual,
} from './supreme-preview'

describe('supreme preview overlays', () => {
  it('covers init and world slugs 11–30 only', () => {
    expect(isSupremeStyleShirtSlug('10-verse-1-timothy-6-18')).toBe(false)
    expect(isSupremeStyleShirtSlug('11-init-open-hand-give')).toBe(true)
    expect(isSupremeStyleShirtSlug('30-world-good-trouble-fun')).toBe(true)
    expect(isSupremeStyleShirtSlug('01-know-a-plug')).toBe(false)
  })

  it('maps every supreme slug to a known variation id', () => {
    const specs = listSupremePreviewSpecs()
    expect(specs).toHaveLength(20)
    const ids = new Set(WORDMARK_VARIATIONS.map((v) => v.id))
    for (const s of specs) {
      expect(ids.has(s.variationId)).toBe(true)
    }
    expect(new Set(specs.map((s) => s.variationId)).size).toBe(20)
  })

  it('raises placement only on shirts that sat low on mockups', () => {
    expect(getSupremePreviewSpec('25-world-free-refills')!.placement.top).toBe(0.578)
    expect(getSupremePreviewSpec('18-init-charge-forward-care')!.placement.top).toBe(0.568)
    expect(getSupremePreviewSpec('16-init-running-over')!.placement.top).toBe(0.558)
    expect(getSupremePreviewSpec('11-init-open-hand-give')!.placement.top).toBe(0.578)
  })

  it('uses plain dark ink on light garment colors', () => {
    const spec = getSupremePreviewSpec('23-world-know-a-plug')!
    const visual = supremeWordmarkVisual(spec, 'White')
    expect(visual.boxed).toBe(false)
    expect(visual.textColor).toBe('#171717')
  })
})
