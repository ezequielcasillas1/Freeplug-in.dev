import { describe, expect, it } from 'vitest'
import {
  isGivingCampaignShirtSlug,
  isVerseShirtSlug,
  resolvePreviewWordmark,
} from './preview-wordmark-resolve'

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

  it('skips preview overlays on buyer-shop items with their own artwork', () => {
    expect(
      resolvePreviewWordmark({
        source: 'buyer-shop',
        slug: 'unisex-heavy-blend-crewneck-sweatshirt-49',
        href: '/shop/unisex-heavy-blend-crewneck-sweatshirt-49',
        productType: 'sweatshirt',
        catalogKey: 'shop/unisex-heavy-blend-crewneck-sweatshirt-49',
      })
    ).toBeNull()
  })

  it('skips preview overlays on merch-store collection items', () => {
    expect(
      resolvePreviewWordmark({
        source: 'merch-store',
        slug: 'hero-crewneck',
        href: '/merch/apparel/hero-crewneck',
        productType: 'apparel',
        catalogKey: 'apparel/hero-crewneck',
      })
    ).toBeNull()
  })

  it('skips designed shop products such as candles, doormats, and pillows', () => {
    for (const input of [
      {
        source: 'buyer-shop' as const,
        slug: 'running-over-luke-6-38-candle',
        href: '/shop/running-over-luke-6-38-candle',
        productType: 'candle',
        catalogKey: 'shop/running-over-luke-6-38-candle',
      },
      {
        source: 'buyer-shop' as const,
        slug: 'come-on-in-youre-plugged-in-doormat',
        href: '/shop/come-on-in-youre-plugged-in-doormat',
        productType: 'doormat',
        catalogKey: 'shop/come-on-in-youre-plugged-in-doormat',
      },
    ]) {
      expect(resolvePreviewWordmark(input)).toBeNull()
    }
  })
})
