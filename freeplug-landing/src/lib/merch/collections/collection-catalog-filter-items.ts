import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import type { MerchCollectionSlug, PublicCollectionProduct } from './catalog'

export function collectionProductsToCatalogFilterItems(
  collection: MerchCollectionSlug,
  products: PublicCollectionProduct[]
): CatalogFilterItem[] {
  return products.map((p, i) => ({
    key: `${collection}/${p.slug}`,
    href: `/merch/${collection}/${p.slug}`,
    title: p.slug,
    sortName: p.slug,
    image: p.mockupSrc,
    fromPriceCents: p.fromPriceCents,
    featuredRank: i + 1,
    category: 'apparel',
    productType: collection,
    source: 'merch-store',
    colors: p.isCrewneck ? ['Black', 'White', 'Sand'] : [],
    sizes: p.optionKeys,
    availability: ['buyable'],
    designs: ['freeplug'],
    comingSoonLabel: false,
  }))
}
