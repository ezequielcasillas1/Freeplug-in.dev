import { describe, expect, it } from 'vitest'
import {
  isGivingCampaignShirtSlug,
  isVerseShirtSlug,
  resolvePreviewWordmark,
} from './preview-wordmark-resolve'
import { WORDMARK_VARIATIONS } from './wordmark-variations'

describe('resolvePreviewWordmark', () => {
  it('skips verse and giving campaign tees', () => {
    expect(resolvePreviewWordmark({
      source: 't-shirts',
      slug: '07-verse-psalm-82-3',
      href: '/merch/t-shirts/07-verse-psalm-82-3',
      productType: 't-shirt',
      catalogKey: 'tshirts/07-verse-psalm-82-3',
    })).toBeNull()
    expect(isVerseShirtSlug('07-verse-psalm-82-3')).toBe(true)
    expect(isGivingCampaignShirtSlug('01-know-a-plug')).toBe(true)
    expect(
      resolvePreviewWordmark({
        source: 't-shirts',
        slug: '01-know-a-plug',
        href: '/merch/t-shirts/01-know-a-plug',
        productType: 't-shirt',
        catalogKey: 'tshirts/01-know-a-plug',
      })
    ).toBeNull()
  })

  it('skips preview overlays on all catalog t-shirts (designed front art)', () => {
    for (const slug of [
      '11-init-open-hand-give',
      '31-world-plugs-dont-work',
      '35-world-straight-after-the-freeplug',
      'patience-undefined',
    ]) {
      expect(
        resolvePreviewWordmark({
          source: 't-shirts',
          slug,
          href: `/merch/t-shirts/${slug}`,
          productType: 't-shirt',
          catalogKey: `tshirts/${slug}`,
          garmentColor: 'Black',
        })
      ).toBeNull()
    }
  })

  it('covers shop physical items with stable variation ids', () => {
    const r = resolvePreviewWordmark({
      source: 'buyer-shop',
      slug: 'unisex-heavy-blend-crewneck-sweatshirt-49',
      href: '/shop/unisex-heavy-blend-crewneck-sweatshirt-49',
      productType: 'sweatshirt',
      catalogKey: 'shop/unisex-heavy-blend-crewneck-sweatshirt-49',
    })
    expect(r).not.toBeNull()
    expect(WORDMARK_VARIATIONS.some((v) => v.id === r!.variationId)).toBe(true)
  })

  it('covers merch-store collection items', () => {
    const r = resolvePreviewWordmark({
      source: 'merch-store',
      slug: 'hero-crewneck',
      href: '/merch/apparel/hero-crewneck',
      productType: 'apparel',
      catalogKey: 'apparel/hero-crewneck',
    })
    expect(r?.placement.top).toBeLessThan(0.6)
  })
})
