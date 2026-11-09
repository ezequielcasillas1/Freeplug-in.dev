import { describe, expect, it } from 'vitest'
import {
  isFreeplugShopComingSoon,
  mockupsForShopColor,
  printifyProductIdForVariant,
  shopHasPrintifyFreeplug,
} from './printify-catalog'

describe('printify shop catalog', () => {
  it('resolves product id per variant for split products', () => {
    const slug = 'unisex-heavy-blend-crewneck-sweatshirt-49'
    const early = printifyProductIdForVariant(slug, 25376)
    const later = printifyProductIdForVariant(slug, 25389)
    expect(early).toBeTruthy()
    expect(later).toBeTruthy()
    expect(early).not.toBe(later)
  })

  it('marks six slugs as coming soon for Freeplug logo', () => {
    expect(isFreeplugShopComingSoon('fanny-pack-468')).toBe(true)
    expect(shopHasPrintifyFreeplug('fanny-pack-468')).toBe(false)
    expect(shopHasPrintifyFreeplug('unisex-heavy-blend-crewneck-sweatshirt-49')).toBe(true)
  })

  it('returns mockups for a color when present', () => {
    const slug = 'unisex-heavy-blend-crewneck-sweatshirt-49'
    const urls = mockupsForShopColor(slug, 'Black')
    expect(urls.length).toBeGreaterThan(0)
    expect(urls[0]).toMatch(/printify\.com/)
  })

  it('bracelet slug has no mockups', () => {
    const urls = mockupsForShopColor('natural-stone-stretch-bar-bracelet-engraving-2651', 'Brown')
    expect(urls.length).toBe(0)
  })
})
