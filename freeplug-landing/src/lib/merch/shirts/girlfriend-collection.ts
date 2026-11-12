import raw from './girlfriend-collection-catalog.json'
import {
  SHIRT_COLORS,
  SHIRT_MIN_FROM_PRICE_CENTS,
  SHIRT_SIZES,
  shirtPriceCents,
  type ShirtCatalogEntry,
  type ShirtColor,
  type ShirtSize,
} from '@/lib/merch/shirts/catalog'

export const GIRLFRIEND_COLLECTION_SLUG = 'girlfriend-collection' as const

export type GirlfriendGarmentInk = 'light' | 'dark'

/** `light` = dark ink on light blanks (White, Natural). `dark` = light ink on dark blanks (Black, Charcoal). */
export const GIRLFRIEND_DESIGN_IDS = [
  '01-no-time',
  '02-plugging-needy',
  '03-deadlines-deeds',
  '04-status-shipping',
  '05-taken-mission',
  '06-single-busy-building',
  '07-love-language',
] as const

export type GirlfriendDesignId = (typeof GIRLFRIEND_DESIGN_IDS)[number]

export type GirlfriendDesignCatalogEntry = {
  id: GirlfriendDesignId
  /** Printify product UUID when live; empty until published. */
  printify_product_id: string
  /** Keys like `S / Black` → Printify variant id (number). */
  variants: Record<string, number>
}

export type GirlfriendCollectionCatalog = {
  pageSlug: string
  checkoutEnabled: boolean
  designs: GirlfriendDesignCatalogEntry[]
}

const catalog = raw as GirlfriendCollectionCatalog

const FRONT_ONLY_STUB: ShirtCatalogEntry = {
  slug: GIRLFRIEND_COLLECTION_SLUG,
  title: 'Girlfriend collection',
  printify_product_id: '',
  back_print: false,
  variants: {},
}

export function getGirlfriendCollectionCatalog(): GirlfriendCollectionCatalog {
  return catalog
}

export function girlfriendCollectionColorsForGarment(garment: GirlfriendGarmentInk): ShirtColor[] {
  return garment === 'light' ? ['White', 'Natural'] : ['Black', 'Charcoal']
}

export function girlfriendCollectionMockupPublicPath(designId: GirlfriendDesignId, garment: GirlfriendGarmentInk): string {
  return `/merch/shirts/girlfriend-collection/${designId}-${garment}.jpg`
}

export function girlfriendCollectionUnitPriceCents(size: ShirtSize): number {
  return shirtPriceCents(FRONT_ONLY_STUB, size)
}

export function girlfriendCollectionFromPriceCents(): number {
  return SHIRT_MIN_FROM_PRICE_CENTS
}

export function girlfriendCollectionDefaultColor(garment: GirlfriendGarmentInk): ShirtColor {
  return garment === 'light' ? 'White' : 'Black'
}

export function girlfriendCollectionCardMockupSrc(): string {
  return girlfriendCollectionMockupPublicPath('01-no-time', 'dark')
}

export { SHIRT_SIZES, SHIRT_COLORS }
