import { listShopItems } from './catalog'
import { shopHeroImageSrc } from './shop-gallery-blank-kind'
import {
  isShopExcludeNoCleanMockupEnabled,
  shopNoCleanMockupSlugs,
} from './shop-exclude-no-clean-mockup'
import {
  isFreeplugShopComingSoon,
  shopHasColorMockups,
  shopHasPrintifyFreeplug,
} from './printify-catalog'
import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'

/** Build-time rows for /shop and /merch/all shop segment (195 items). */
export function listShopFilterItems(): CatalogFilterItem[] {
  const excludeNoClean = isShopExcludeNoCleanMockupEnabled()
  const noClean = excludeNoClean ? shopNoCleanMockupSlugs() : null
  return listShopItems()
    .filter((item) => !noClean?.has(item.slug))
    .map((item) => {
    const comingSoon = isFreeplugShopComingSoon(item.slug)
    const hasFreeplug = shopHasPrintifyFreeplug(item.slug)
    const hasMockups = shopHasColorMockups(item.slug)
    const availability: CatalogFilterItem['availability'][number][] = []
    if (!comingSoon) availability.push('buyable')
    if (comingSoon) availability.push('coming-soon')
    if (!hasMockups || item.placeholder) availability.push('missing-mockup')

    const designs: CatalogFilterItem['designs'][number][] = ['custom']
    if (hasFreeplug) designs.push('freeplug')

    return {
      key: `shop/${item.slug}`,
      href: `/shop/${item.slug}`,
      title: item.title,
      sortName: item.title,
      image: shopHeroImageSrc(item),
      fromPriceCents: item.fromRetailCents,
      featuredRank: item.featuredRank,
      category: item.tab,
      productType: item.productType,
      source: 'buyer-shop',
      colors: item.colors,
      sizes: item.sizes,
      availability,
      designs,
      comingSoonLabel: comingSoon,
      gallery: item.gallery,
      galleryBlankKinds: item.galleryBlankKinds,
    }
  })
}
