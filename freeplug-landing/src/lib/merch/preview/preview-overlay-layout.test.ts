import { describe, expect, it } from 'vitest'
import { getSupremePreviewSpec, supremeWordmarkPlacement } from '@/lib/merch/shirts/supreme-preview'
import { placementToSvgPoint, wordmarkScaleFromPlacement } from './preview-overlay-layout'
import { resolvePreviewWordmark } from './preview-wordmark-resolve'

describe('preview overlay layout', () => {
  it('places slogan tee badges on wearers left upper chest', () => {
    const spec = getSupremePreviewSpec('11-init-open-hand-give')!
    const wp = supremeWordmarkPlacement(spec)
    expect(wp.left).toBeGreaterThan(0.55)
    expect(wp.top).toBeLessThan(0.33)
    expect(wp.width).toBeGreaterThanOrEqual(0.1)
    expect(wp.width).toBeLessThanOrEqual(0.13)
    const { cx, cy } = placementToSvgPoint(wp)
    expect(cx).toBeGreaterThan(55)
    expect(cy).toBeLessThan(33)
  })

  it('scales small chest badges to ~12% shirt width', () => {
    const scale = wordmarkScaleFromPlacement({ width: 0.12 })
    expect(scale).toBeCloseTo(0.25, 2)
  })

  it('keeps original mockups for slogan tees with chestBadge overlay', () => {
    const r = resolvePreviewWordmark({
      source: 't-shirts',
      slug: '28-world-taste-the-charge',
      href: '/merch/t-shirts/28-world-taste-the-charge',
      productType: 't-shirt',
      catalogKey: 'tshirts/28-world-taste-the-charge',
      garmentColor: 'Black',
    })
    expect(r?.placement.left).toBeGreaterThan(0.55)
    expect(r?.chestBadge).toBe(true)
    expect(r?.printSurface).toBe(true)
    expect((r as { useBlankGarmentMockup?: boolean }).useBlankGarmentMockup).toBeUndefined()
  })
})
