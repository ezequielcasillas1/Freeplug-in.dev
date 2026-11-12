import raw from './girlfriend-collection-catalog.json'
import {
  SHIRT_COLORS,
  SHIRT_MIN_FROM_PRICE_CENTS,
  SHIRT_SIZES,
  shirtPriceCents,
  parseShirtColor,
  parseShirtSize,
  variantKey,
  type ShirtCatalogEntry,
  type ShirtColor,
  type ShirtSize,
  type ValidatedShirtLine,
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

const GIRLFRIEND_DESIGN_TITLES: Record<GirlfriendDesignId, string> = {
  '01-no-time': "Don't have time",
  '02-plugging-needy': 'Plugging the needy',
  '03-deadlines-deeds': 'Deadlines and deeds',
  '04-status-shipping': 'Status: shipping',
  '05-taken-mission': 'Taken by the mission',
  '06-single-busy-building': 'Single. Busy. Building.',
  '07-love-language': 'Love language',
}

export function girlfriendDesignCheckoutTitle(designId: GirlfriendDesignId): string {
  return `Girlfriend collection — ${GIRLFRIEND_DESIGN_TITLES[designId]}`
}

export function getGirlfriendDesignById(designId: string): GirlfriendDesignCatalogEntry | null {
  return catalog.designs.find((d) => d.id === designId) ?? null
}

export function parseGirlfriendDesignId(v: unknown): GirlfriendDesignId | null {
  return typeof v === 'string' && (GIRLFRIEND_DESIGN_IDS as readonly string[]).includes(v)
    ? (v as GirlfriendDesignId)
    : null
}

export function resolveGirlfriendPrintifyVariantId(
  design: GirlfriendDesignCatalogEntry,
  size: ShirtSize,
  color: ShirtColor
): number | null {
  const id = design.variants[variantKey(size, color)]
  return typeof id === 'number' ? id : null
}

export function validateGirlfriendCheckoutLine(input: {
  design: unknown
  color: unknown
  size: unknown
  quantity: unknown
}): { ok: true; line: ValidatedShirtLine } | { ok: false; error: string } {
  if (!catalog.checkoutEnabled) {
    return { ok: false, error: 'This product is not available for checkout yet.' }
  }

  const designId = parseGirlfriendDesignId(input.design)
  if (!designId) return { ok: false, error: 'Invalid design.' }

  const design = getGirlfriendDesignById(designId)
  if (!design?.printify_product_id?.trim()) return { ok: false, error: 'Unknown product.' }

  const color = parseShirtColor(input.color)
  const size = parseShirtSize(input.size)
  if (!color || !size) return { ok: false, error: 'Invalid size or color.' }

  const variantId = resolveGirlfriendPrintifyVariantId(design, size, color)
  if (variantId == null) return { ok: false, error: 'This combination is not available.' }

  const qtyRaw = input.quantity
  const quantity =
    typeof qtyRaw === 'number' && Number.isInteger(qtyRaw)
      ? qtyRaw
      : typeof qtyRaw === 'string'
        ? parseInt(qtyRaw, 10)
        : NaN
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 10) {
    return { ok: false, error: 'Quantity must be between 1 and 10.' }
  }

  return {
    ok: true,
    line: {
      slug: GIRLFRIEND_COLLECTION_SLUG,
      title: girlfriendDesignCheckoutTitle(designId),
      color,
      size,
      quantity,
      unitAmountCents: girlfriendCollectionUnitPriceCents(size),
      printifyProductId: design.printify_product_id.trim(),
      printifyVariantId: variantId,
      backPrint: false,
      designId,
    },
  }
}

export { SHIRT_SIZES, SHIRT_COLORS }
