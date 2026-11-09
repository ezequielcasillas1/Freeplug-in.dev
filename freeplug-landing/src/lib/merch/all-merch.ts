import { MERCH_COLLECTIONS, listPublicCollectionProducts, type MerchCollectionSlug } from '@/lib/merch/collections/catalog'
import { listPublicShirtProducts } from '@/lib/merch/shirts/catalog'
import { listShopCards } from '@/lib/merch/shop/catalog'
import { isFreeplugShopComingSoon } from '@/lib/merch/shop/printify-catalog'
import type { ShopTabSlug } from '@/lib/merch/shop/types'
import type { AllMerchItem } from '@/lib/merch/all-merch-shared'

export type { AllMerchItem } from '@/lib/merch/all-merch-shared'
export { ALL_MERCH_CATEGORIES, countAllMerchByCategory } from '@/lib/merch/all-merch-shared'

const COLLECTION_CATEGORY: Record<MerchCollectionSlug, ShopTabSlug> = {
  drinkware: 'drinkware',
  hats: 'hats',
  apparel: 'apparel',
  'kids-baby': 'kids',
  'bags-accessories': 'bags',
  pets: 'pets',
  'home-living': 'home',
  'home-faith': 'home',
  'desk-extras': 'tech-desk',
  'wall-art': 'wall-art',
  outdoor: 'outdoor',
}

export function listAllMerchItems(): AllMerchItem[] {
  const shirts: AllMerchItem[] = listPublicShirtProducts().map((p) => ({
    key: `tshirts/${p.slug}`,
    href: `/merch/t-shirts/${p.slug}`,
    category: 'apparel',
    titleKey: `tshirts.products.${p.titleKey}`,
    title: p.slug,
    image: p.mockups['Black-front'] ?? p.mockups['White-front'] ?? '',
    fromPriceCents: p.fromPriceCents,
    comingSoon: false,
  }))
  const collections: AllMerchItem[] = MERCH_COLLECTIONS.flatMap((collection) =>
    listPublicCollectionProducts(collection).map((p) => ({
      key: `${collection}/${p.slug}`,
      href: `/merch/${collection}/${p.slug}`,
      category: COLLECTION_CATEGORY[collection],
      titleKey: `collections.products.${p.titleKey}`,
      title: p.slug,
      image: p.mockupSrc,
      fromPriceCents: p.fromPriceCents,
      comingSoon: false,
    }))
  )
  const shop: AllMerchItem[] = listShopCards().map((c) => ({
    key: `shop/${c.slug}`,
    href: `/shop/${c.slug}`,
    category: c.tab,
    titleKey: null,
    title: c.title,
    image: c.gridImage,
    fromPriceCents: c.fromRetailCents,
    comingSoon: isFreeplugShopComingSoon(c.slug),
  }))
  return [...shirts, ...collections, ...shop]
}
