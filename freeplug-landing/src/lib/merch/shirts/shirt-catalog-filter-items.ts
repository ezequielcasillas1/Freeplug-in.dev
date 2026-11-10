import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { shirtListCardFrontMockup, type PublicShirtProduct } from './catalog'

/** Rows for wordmark / catalog filters on /merch/t-shirts. */
export function shirtProductsToCatalogFilterItems(products: PublicShirtProduct[]): CatalogFilterItem[] {
  return products.map((p, i) => {
    const { color, src } = shirtListCardFrontMockup(p)
    return {
      key: `tshirts/${p.slug}`,
      href: `/merch/t-shirts/${p.slug}`,
      title: p.slug,
      sortName: p.slug,
      image: src,
      fromPriceCents: p.fromPriceCents,
      featuredRank: i + 1,
      category: 'apparel',
      productType: 't-shirt',
      source: 't-shirts',
      colors: [color],
      sizes: [...p.sizes],
      availability: ['buyable'],
      designs: ['freeplug'],
      comingSoonLabel: false,
    }
  })
}
