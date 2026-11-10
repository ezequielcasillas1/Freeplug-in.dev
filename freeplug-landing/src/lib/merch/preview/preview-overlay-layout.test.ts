import { describe, expect, it } from 'vitest'
import { getSupremePreviewSpec } from '@/lib/merch/shirts/supreme-preview'
import {
  placementToSvgPoint,
  supremeBakedPrintMask,
  wordmarkScaleFromPlacement,
} from './preview-overlay-layout'
import { resolvePreviewWordmark } from './preview-wordmark-resolve'

describe('preview overlay layout', () => {
  it('maps placement.left to svg cx (not hard-coded center)', () => {
    const spec = getSupremePreviewSpec('11-init-open-hand-give')!
    const { cx } = placementToSvgPoint(spec.placement)
    expect(cx).toBeCloseTo(31, 0)
    expect(cx).not.toBe(50)
  })

  it('scales wordmarks to placement width without overshoot', () => {
    const scale = wordmarkScaleFromPlacement({ width: 0.38 })
    expect(scale).toBeLessThan(1)
    expect(scale).toBeCloseTo(0.792, 2)
  })

  it('includes baked print mask for init supreme tees', () => {
    const r = resolvePreviewWordmark({
      source: 't-shirts',
      slug: '28-world-taste-the-charge',
      href: '/merch/t-shirts/28-world-taste-the-charge',
      productType: 't-shirt',
      catalogKey: 'tshirts/28-world-taste-the-charge',
      garmentColor: 'Black',
    })
    expect(r?.placement.left).toBe(0.36)
    expect(r?.bakedPrintMask).toBeDefined()
    expect(r?.bakedPrintMask!.width).toBeGreaterThan(r!.placement.width)
    expect(supremeBakedPrintMask(getSupremePreviewSpec('28-world-taste-the-charge')!, 'dark').fill).toMatch(/^#/)
  })
})
