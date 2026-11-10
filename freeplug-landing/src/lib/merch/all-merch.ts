import { MERCH_COLLECTIONS, listPublicCollectionProducts, type MerchCollectionSlug } from '@/lib/merch/collections/catalog'
import { listPublicShirtProducts, shirtListCardFrontMockup } from '@/lib/merch/shirts/catalog'
import type { CatalogAvailability, CatalogDesign } from '@/lib/merch/catalog-filter-types'
import type { AllMerchItem } from '@/lib/merch/all-merch-shared'
import { listShopFilterItems } from '@/lib/merch/shop/shop-filter-items'
import type { ShopTabSlug } from '@/lib/merch/shop/types'

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

const MERCH_AVAIL: CatalogAvailability[] = ['buyable']
const MERCH_DESIGNS: CatalogDesign[] = ['freeplug']

function parseCrewneckSizes(optionKeys: string[]): string[] {
  const sizes = new Set<string>()
  for (const k of optionKeys) {
    const part = k.split('/')[0]?.trim()
    if (part) sizes.add(part)
  }
  return [...sizes].sort()
}

function parseCrewneckColors(optionKeys: string[]): string[] {
  const colors = new Set<string>()
  for (const k of optionKeys) {
    const part = k.split('/')[1]?.trim()
    if (part) colors.add(part)
  }
  return [...colors].sort()
}

export function listAllMerchItems(): AllMerchItem[] {
  const shirts: AllMerchItem[] = listPublicShirtProducts().map((p, i) => ({
    key: `tshirts/${p.slug}`,
    href: `/merch/t-shirts/${p.slug}`,
    category: 'apparel',
    titleKey: `tshirts.products.${p.titleKey}`,
    title: p.slug,
    sortName: p.slug,
    image: shirtListCardFrontMockup(p).src,
    fromPriceCents: p.fromPriceCents,
    featuredRank: i + 1,
    productType: 't-shirt',
    source: 't-shirts',
    colors: p.colors,
    sizes: p.sizes,
    availability: MERCH_AVAIL,
    designs: MERCH_DESIGNS,
    comingSoonLabel: false,
    comingSoon: false,
  }))

  const collections: AllMerchItem[] = MERCH_COLLECTIONS.flatMap((collection, ci) =>
    listPublicCollectionProducts(collection).map((p, pi) => {
      const colors = p.isCrewneck ? parseCrewneckColors(p.optionKeys) : []
      const sizes = p.isCrewneck ? parseCrewneckSizes(p.optionKeys) : p.optionKeys.length ? [p.optionKeys[0]!] : []
      return {
        key: `${collection}/${p.slug}`,
        href: `/merch/${collection}/${p.slug}`,
        category: COLLECTION_CATEGORY[collection],
        titleKey: `collections.products.${p.titleKey}`,
        title: p.slug,
        sortName: p.slug,
        image: p.mockupSrc,
        fromPriceCents: p.fromPriceCents,
        featuredRank: 100 + ci * 50 + pi,
        productType: collection,
        source: 'merch-store',
        colors,
        sizes: sizes.length ? sizes : p.optionKeys.length === 1 ? [] : p.optionKeys.map((k) => k.trim()).filter(Boolean),
        availability: MERCH_AVAIL,
        designs: MERCH_DESIGNS,
        comingSoonLabel: false,
        comingSoon: false,
      }
    })
  )

  const shop: AllMerchItem[] = listShopFilterItems().map((row) => ({
    ...row,
    titleKey: null,
    comingSoon: row.comingSoonLabel,
  }))

  return [...shirts, ...collections, ...shop]
}
