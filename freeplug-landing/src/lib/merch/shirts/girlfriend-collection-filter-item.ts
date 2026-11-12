import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import {
  girlfriendCollectionCardMockupSrc,
  girlfriendCollectionFromPriceCents,
  GIRLFRIEND_COLLECTION_SLUG,
  SHIRT_SIZES,
} from '@/lib/merch/shirts/girlfriend-collection'

/** Optional t-shirts grid row for the girlfriend collection PDP (coming soon). */
export function girlfriendCollectionCatalogFilterItem(): CatalogFilterItem {
  return {
    key: `tshirts/${GIRLFRIEND_COLLECTION_SLUG}`,
    href: `/merch/t-shirts/${GIRLFRIEND_COLLECTION_SLUG}`,
    title: GIRLFRIEND_COLLECTION_SLUG,
    sortName: 'girlfriend collection',
    image: girlfriendCollectionCardMockupSrc(),
    fromPriceCents: girlfriendCollectionFromPriceCents(),
    featuredRank: 0,
    category: 'apparel',
    productType: 't-shirt',
    source: 't-shirts',
    colors: ['Black'],
    sizes: [...SHIRT_SIZES],
    availability: ['coming-soon'],
    designs: ['freeplug'],
    comingSoonLabel: true,
  }
}
