import { describe, expect, it } from 'vitest'
import { buyerWordmarkArtPublicPath } from '@/lib/merch/preview/buyer-wordmark-art-paths'
import { listShopFilterItems } from './shop-filter-items'
import { shopGridGarmentBlankKind, shopGridMockupPropsForItem } from './shop-grid-mockup-props'

describe('shopGridMockupProps', () => {
  it('uses dark ink on District 1979 grid hero (slide 0)', () => {
    const item = listShopFilterItems().find((i) => i.key.includes('1979'))
    expect(item).toBeTruthy()
    const kind = shopGridGarmentBlankKind(item!)
    expect(kind).toBe('dark')
    const props = shopGridMockupPropsForItem(item!)
    expect(props.overlay?.blankKind).toBe('dark')
    const parsed = buyerWordmarkArtPublicPath('cursive', 'freeplug-dev', 'dark')
    expect(parsed).toContain('-on-dark.png')
  })

  it('matches blank kind to analyzed slide for every catalog row', () => {
    const items = listShopFilterItems()
    const mismatches: string[] = []
    for (const item of items) {
      if (!item.galleryBlankKinds?.length || !item.image) continue
      const kind = shopGridGarmentBlankKind(item)
      const props = shopGridMockupPropsForItem(item)
      if (props.overlay && props.overlay.blankKind !== kind) {
        mismatches.push(item.key)
      }
    }
    expect(mismatches).toEqual([])
  })
})
