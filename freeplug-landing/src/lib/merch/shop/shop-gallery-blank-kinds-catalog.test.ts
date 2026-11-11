import { describe, expect, it } from 'vitest'
import { listShopItems } from './catalog'

describe('shop catalog galleryBlankKinds', () => {
  it('has analyzed blank kind for every gallery slide', () => {
    const items = listShopItems()
    for (const item of items) {
      expect(item.galleryBlankKinds?.length).toBe(item.gallery.length)
    }
  })
})
