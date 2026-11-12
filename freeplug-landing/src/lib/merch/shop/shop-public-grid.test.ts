import { describe, expect, it } from 'vitest'
import { listShopFilterItems } from '@/lib/merch/shop/shop-filter-items'
import {
  filterItemsForPublicGrid,
  orderShopPublicGridItems,
  shopItemComingSoon,
  shopItemMissingMockup,
  shopItemVisibleInPublicGrid,
} from '@/lib/merch/shop/shop-public-grid'
import { EMPTY_CATALOG_FILTER } from '@/lib/merch/catalog-filter-types'

describe('shop-public-grid', () => {
  const shopItems = listShopFilterItems()

  it('flags missing mockup and coming soon from current catalog only', () => {
    const missing = shopItems.filter(shopItemMissingMockup)
    const soon = shopItems.filter(shopItemComingSoon)
    expect(missing).toHaveLength(6)
    expect(soon).toHaveLength(6)
  })

  it('hides missing-mockup rows by default but keeps them when availability filter includes missing-mockup', () => {
    const defaultVisible = filterItemsForPublicGrid(shopItems, EMPTY_CATALOG_FILTER)
    expect(defaultVisible.length).toBe(shopItems.length - 6)
    const withFilter = filterItemsForPublicGrid(shopItems, {
      ...EMPTY_CATALOG_FILTER,
      availability: ['missing-mockup'],
    })
    expect(withFilter.length).toBe(shopItems.length)
  })

  it('sorts coming-soon shop items after buyable peers', () => {
    const ordered = orderShopPublicGridItems(shopItems, 'featured')
    const lastSix = ordered.slice(-6)
    expect(lastSix.every(shopItemComingSoon)).toBe(true)
    expect(ordered.slice(0, 3).every((i) => !shopItemComingSoon(i))).toBe(true)
  })

  it('shopItemVisibleInPublicGrid is true for non-shop sources', () => {
    expect(
      shopItemVisibleInPublicGrid({
        key: 't/x',
        href: '/',
        title: 'x',
        sortName: 'x',
        image: '',
        fromPriceCents: 100,
        featuredRank: 1,
        category: 'apparel',
        productType: 't-shirt',
        source: 't-shirts',
        colors: [],
        sizes: [],
        availability: ['buyable'],
        designs: ['freeplug'],
        comingSoonLabel: false,
      })
    ).toBe(true)
  })
})
