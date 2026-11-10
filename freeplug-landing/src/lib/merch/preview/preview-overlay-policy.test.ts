import { describe, expect, it } from 'vitest'
import {
  listStorefrontOverlayKeepers,
  previewOverlayPolicyCounts,
  shouldShowPreviewWordmarkOverlay,
} from './preview-overlay-policy'
import { resolvePreviewWordmark } from './preview-wordmark-resolve'

describe('preview overlay policy', () => {
  it('matches classification cohort sizes', () => {
    const c = previewOverlayPolicyCounts()
    expect(c.printifyGroupA).toBe(305)
    expect(c.printifyGroupB).toBe(9)
    expect(c.printifyUnknown).toBe(118)
  })

  it('keeps overlay on approved Group A beanie only (vibrant-art suppress elsewhere)', () => {
    const allow = shouldShowPreviewWordmarkOverlay({
      source: 'buyer-shop',
      slug: '12-solid-cuffed-beanie-5665',
      catalogKey: 'shop/12-solid-cuffed-beanie-5665',
    })
    expect(allow.allow).toBe(true)
    expect(allow.printifyProductId).toBe('6af1827130966f8b83011b71')
    expect(resolvePreviewWordmark({
      source: 'buyer-shop',
      slug: '12-solid-cuffed-beanie-5665',
      href: '/shop/12-solid-cuffed-beanie-5665',
      productType: 'hat',
      catalogKey: 'shop/12-solid-cuffed-beanie-5665',
    })).not.toBeNull()
  })

  it('suppresses Group A accent mug (baked red rectangle doubles)', () => {
    const allow = shouldShowPreviewWordmarkOverlay({
      source: 'buyer-shop',
      slug: '11oz-accent-mug-583',
      catalogKey: 'shop/11oz-accent-mug-583',
    })
    expect(allow.allow).toBe(false)
    expect(allow.printifyProductId).toBe('6af183f492f82957dc0865d0')
    expect(
      resolvePreviewWordmark({
        source: 'buyer-shop',
        slug: '11oz-accent-mug-583',
        href: '/shop/11oz-accent-mug-583',
        productType: 'mug',
        catalogKey: 'shop/11oz-accent-mug-583',
      })
    ).toBeNull()
  })

  it('removes overlay on Group B FP circle trucker cap', () => {
    expect(
      resolvePreviewWordmark({
        source: 'merch-store',
        slug: 'fp-circle-trucker-cap',
        href: '/merch/hats/fp-circle-trucker-cap',
        productType: 'hat',
        catalogKey: 'hats/fp-circle-trucker-cap',
      })
    ).toBeNull()
  })

  it('removes overlay on Unknown Open Hand tee', () => {
    expect(
      resolvePreviewWordmark({
        source: 't-shirts',
        slug: '11-init-open-hand-give',
        href: '/merch/t-shirts/11-init-open-hand-give',
        productType: 't-shirt',
        catalogKey: 'tshirts/11-init-open-hand-give',
        garmentColor: 'Black',
      })
    ).toBeNull()
  })

  it('lists explicit storefront keepers for PR review', () => {
    const keepers = listStorefrontOverlayKeepers()
    expect(keepers.length).toBe(previewOverlayPolicyCounts().storefrontKeepOverlay)
    expect(keepers.some((k) => k.siteHref === '/shop/12-solid-cuffed-beanie-5665')).toBe(true)
  })
})
