import type { CatalogAvailability, CatalogFilterItem, CatalogFilterState, CatalogSort } from '@/lib/merch/catalog-filter-types'
import { sortCatalogItems } from '@/lib/merch/catalog-filter-logic'

/** True when the buyer-shop row lacks grid mockups (current catalog + printify-products.json only). */
export function shopItemMissingMockup(item: CatalogFilterItem): boolean {
  return item.source === 'buyer-shop' && item.availability.includes('missing-mockup')
}

/** Coming-soon rows from SHOP_FREEPLUG_COMING_SOON_SLUGS (base slug, not future variant drafts). */
export function shopItemComingSoon(item: CatalogFilterItem): boolean {
  return item.source === 'buyer-shop' && item.comingSoonLabel === true
}

/** Public catalog grids hide missing-mockup shop rows unless the buyer filters for them. */
export function shopItemVisibleInPublicGrid(item: CatalogFilterItem): boolean {
  if (item.source !== 'buyer-shop') return true
  return !shopItemMissingMockup(item)
}

function buyerExplicitlyShowsMissingMockups(state: CatalogFilterState): boolean {
  return state.availability.includes('missing-mockup' as CatalogAvailability)
}

/** Grid pool: full list for facets; this narrows default buyer-shop visibility. */
export function filterItemsForPublicGrid(items: CatalogFilterItem[], state: CatalogFilterState): CatalogFilterItem[] {
  if (buyerExplicitlyShowsMissingMockups(state)) return items
  return items.filter(shopItemVisibleInPublicGrid)
}

/** Stable-sort coming-soon buyer-shop rows after buyable peers (reuse after PR #59 grouping). */
export function orderShopPublicGridItems(items: CatalogFilterItem[], sort: CatalogSort): CatalogFilterItem[] {
  const sorted = sortCatalogItems(items, sort)
  const soon: CatalogFilterItem[] = []
  const rest: CatalogFilterItem[] = []
  for (const item of sorted) {
    if (shopItemComingSoon(item)) soon.push(item)
    else rest.push(item)
  }
  return [...rest, ...soon]
}
