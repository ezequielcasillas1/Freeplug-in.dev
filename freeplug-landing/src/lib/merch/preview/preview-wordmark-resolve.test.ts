import { describe, expect, it } from 'vitest'
import {
  isGivingCampaignShirtSlug,
  isVerseShirtSlug,
  resolvePreviewWordmark,
} from './preview-wordmark-resolve'
import { shouldShowPreviewWordmarkOverlay } from './preview-overlay-policy'
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

  it('does not overlay slogan supreme tees (Unknown cohort)', () => {
    expect(
      shouldShowPreviewWordmarkOverlay({
        source: 't-shirts',
        slug: '11-init-open-hand-give',
        catalogKey: 'tshirts/11-init-open-hand-give',
      }).allow
    ).toBe(false)
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

  it('covers approved shop physical items with stable variation ids', () => {
    const r = resolvePreviewWordmark({
      source: 'buyer-shop',
      slug: '12-solid-cuffed-beanie-5665',
      href: '/shop/12-solid-cuffed-beanie-5665',
      productType: 'hat',
      catalogKey: 'shop/12-solid-cuffed-beanie-5665',
    })
    expect(r).not.toBeNull()
    expect(WORDMARK_VARIATIONS.some((v) => v.id === r!.variationId)).toBe(true)
  })

  it('drops overlay on shop items with vibrant baked rectangle art', () => {
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

  it('drops overlay on merch-store collection items without policy keep', () => {
    const r = resolvePreviewWordmark({
      source: 'merch-store',
      slug: 'hero-crewneck',
      href: '/merch/apparel/hero-crewneck',
      productType: 'apparel',
      catalogKey: 'apparel/hero-crewneck',
    })
    expect(r).toBeNull()
  })
})
