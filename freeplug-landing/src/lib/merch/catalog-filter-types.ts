/** Client-safe catalog filter types (no JSON catalog imports). */
import type { BrandNameKey } from '@/lib/merch/preview/brand-names'
import type { ShopTabSlug } from '@/lib/merch/shop/types'

export type CatalogSource = 'merch-store' | 't-shirts' | 'buyer-shop'

export type CatalogAvailability = 'buyable' | 'coming-soon' | 'missing-mockup'

export type CatalogDesign = 'freeplug' | 'custom'

export type CatalogSort = 'featured' | 'price-asc' | 'price-desc' | 'name-asc'

/** Unified row for filter logic on /merch/all and /shop. */
export type CatalogFilterItem = {
  /** Stable list key (slug path). */
  key: string
  href: string
  title: string
  /** Sort / display name (English). */
  sortName: string
  image: string
  fromPriceCents: number
  featuredRank: number
  category: ShopTabSlug
  productType: string | null
  source: CatalogSource | null
  colors: readonly string[]
  sizes: readonly string[]
  availability: readonly CatalogAvailability[]
  designs: readonly CatalogDesign[]
  comingSoonLabel: boolean
}

export type CatalogFilterState = {
  sources: CatalogSource[]
  categories: ShopTabSlug[]
  productTypes: string[]
  availability: CatalogAvailability[]
  minPriceCents: number | null
  maxPriceCents: number | null
  colors: string[]
  sizes: string[]
  designs: CatalogDesign[]
  sort: CatalogSort
  /** When false, mockup name previews are hidden (`preview=0` in URL). */
  previewOverlays: boolean
  /** Filter to init/world rectangular-style tees (`style=rectangular`). */
  rectangularStyleOnly: boolean
  /** Filter by capital-F brand name on the preview (`name=` CSV). */
  brandNameKeys: BrandNameKey[]
}

export const EMPTY_CATALOG_FILTER: CatalogFilterState = {
  sources: [],
  categories: [],
  productTypes: [],
  availability: [],
  minPriceCents: null,
  maxPriceCents: null,
  colors: [],
  sizes: [],
  designs: [],
  sort: 'featured',
  previewOverlays: true,
  rectangularStyleOnly: false,
  brandNameKeys: [],
}

export type CatalogFacets = {
  sources: Record<CatalogSource, number>
  categories: Record<ShopTabSlug, number>
  productTypes: Record<string, number>
  availability: Record<CatalogAvailability, number>
  designs: Record<CatalogDesign, number>
  colors: Record<string, number>
  sizes: Record<string, number>
  priceMinCents: number
  priceMaxCents: number
  total: number
}
