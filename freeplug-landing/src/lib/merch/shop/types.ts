export type ShopTabSlug =
  | 'apparel'
  | 'hats'
  | 'drinkware'
  | 'home'
  | 'wall-art'
  | 'bags'
  | 'tech-desk'
  | 'pets'
  | 'kids'
  | 'outdoor'
  | 'accessories'

export type ShopPrintArea = {
  place: string
  width: number
  height: number
  position: { x: number; y: number; scale: number }
}

export type ShopVariant = {
  id: number
  title: string | null
  color: string | null
  size: string | null
  costCents: number
  retailCents: number
  blankKind: 'light' | 'dark'
  logoFile: string
}

export type ShopCatalogItem = {
  slug: string
  blueprintId: number
  providerId: number
  providerName: string
  title: string
  brand: string
  model: string
  category: string
  tab: ShopTabSlug
  productType: string
  featuredRank: number
  variantCount: number
  costMinCents: number
  costMaxCents: number
  fromRetailCents: number
  shippingFirstCents: number
  shippingAdditionalCents: number
  colors: string[]
  sizes: string[]
  variants: ShopVariant[]
  imageUrl: string | null
  placeholder: boolean
  printArea: ShopPrintArea
}

export type ShopCard = Pick<
  ShopCatalogItem,
  | 'slug'
  | 'title'
  | 'tab'
  | 'productType'
  | 'category'
  | 'fromRetailCents'
  | 'featuredRank'
  | 'placeholder'
  | 'colors'
>

export const SHOP_TABS: ShopTabSlug[] = [
  'apparel',
  'hats',
  'drinkware',
  'home',
  'wall-art',
  'bags',
  'tech-desk',
  'pets',
  'kids',
  'outdoor',
  'accessories',
]

export const MERCH_SHOP_FREE_SHIPPING_THRESHOLD_CENTS = 5000
