import { describe, expect, it } from 'vitest'
import { isWordmarkVariationId } from '@/lib/merch/preview/wordmark-variations'
import { garmentWordmarkForShopSlug } from './garment-wordmark-for-shop'

describe('garmentWordmarkForShopSlug', () => {
  it('uses supreme mapping when slug is an init/world tee', () => {
    expect(garmentWordmarkForShopSlug('23-world-know-a-plug')).toBe('v03-fpid-outline')
  })

  it('returns a valid variation id for generic shop slugs', () => {
    const id = garmentWordmarkForShopSlug('unisex-heavy-blend-crewneck-sweatshirt-49')
    expect(isWordmarkVariationId(id)).toBe(true)
  })
})
