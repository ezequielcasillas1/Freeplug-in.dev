import { describe, expect, it } from 'vitest'
import { getSupremePreviewSpec, isSupremeStyleShirtSlug, supremeWordmarkVisual } from './supreme-preview'

describe('supreme preview overlays', () => {
  it('covers init and world slugs 11–30 only', () => {
    expect(isSupremeStyleShirtSlug('10-verse-1-timothy-6-18')).toBe(false)
    expect(isSupremeStyleShirtSlug('11-init-open-hand-give')).toBe(true)
    expect(isSupremeStyleShirtSlug('30-world-good-trouble-fun')).toBe(true)
    expect(isSupremeStyleShirtSlug('01-know-a-plug')).toBe(false)
  })

  it('uses plain dark ink on light garment colors', () => {
    const spec = getSupremePreviewSpec('23-world-know-a-plug')!
    expect(spec.lines).toEqual(['KNOW A PLUG'])
    const visual = supremeWordmarkVisual(spec, 'White')
    expect(visual.boxed).toBe(false)
    expect(visual.textColor).toBe('#171717')
  })

  it('keeps boxed light ink on black garment', () => {
    const spec = getSupremePreviewSpec('23-world-know-a-plug')!
    const visual = supremeWordmarkVisual(spec, 'Black')
    expect(visual.boxed).toBe(true)
    expect(visual.textColor).toBe('#ffffff')
  })
})
