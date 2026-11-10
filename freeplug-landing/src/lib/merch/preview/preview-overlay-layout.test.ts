import { describe, expect, it } from 'vitest'
import { getSupremePreviewSpec } from '@/lib/merch/shirts/supreme-preview'
import { supremeWordmarkPlacement } from '@/lib/merch/shirts/supreme-preview'
import {
  placementToSvgPoint,
  wordmarkScaleFromPlacement,
} from './preview-overlay-layout'
import { resolvePreviewWordmark } from './preview-wordmark-resolve'

describe('preview overlay layout', () => {
  it('centers supreme wordmarks on the chest', () => {
    const spec = getSupremePreviewSpec('11-init-open-hand-give')!
    const wp = supremeWordmarkPlacement(spec)
    expect(wp.left).toBe(0.5)
    const { cx } = placementToSvgPoint(wp)
    expect(cx).toBe(50)
  })

  it('scales wordmarks to placement width without overshoot', () => {
    const scale = wordmarkScaleFromPlacement({ width: 0.27 })
    expect(scale).toBeLessThan(0.6)
    expect(scale).toBeCloseTo(0.5625, 2)
  })

  it('uses blank garment mockup flag for init supreme tees', () => {
    const r = resolvePreviewWordmark({
      source: 't-shirts',
      slug: '28-world-taste-the-charge',
      href: '/merch/t-shirts/28-world-taste-the-charge',
      productType: 't-shirt',
      catalogKey: 'tshirts/28-world-taste-the-charge',
      garmentColor: 'Black',
    })
    expect(r?.placement.left).toBe(0.5)
    expect(r?.printSurface).toBe(true)
    expect(r?.useBlankGarmentMockup).toBe(true)
  })
})
