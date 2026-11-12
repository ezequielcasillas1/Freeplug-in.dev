import rawCatalog from './shirts-catalog.json'
import { shirtGarmentDisplayMockupSrc } from '@/lib/merch/shirts/shirt-display-mockup'

export const SHIRT_CURRENCY = 'usd' as const
export const SHIRT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'] as const
export const SHIRT_COLORS = ['Black', 'Charcoal', 'Natural', 'White'] as const

export type ShirtSize = (typeof SHIRT_SIZES)[number]
export type ShirtColor = (typeof SHIRT_COLORS)[number]

export type ShirtCatalogEntry = {
  slug: string
  title: string
  printify_product_id: string
  back_print: boolean
  variants: Record<string, number>
}

const catalog = rawCatalog as ShirtCatalogEntry[]

export const MERCH_SHIRT_CHECKOUT_TYPE = 'merch_shirt' as const
export const PRINTIFY_SHOP_ID_DEFAULT = '29664778'

/** Front-only designs 03–06 */
const FRONT_ONLY_PRICE: Record<ShirtSize, number> = {
  S: 1599,
  M: 1599,
  L: 1599,
  XL: 1599,
  '2XL': 1799,
  '3XL': 1999,
}

/** Front+back designs 01–02 */
const FRONT_BACK_PRICE: Record<ShirtSize, number> = {
  S: 2199,
  M: 2199,
  L: 2199,
  XL: 2199,
  '2XL': 2399,
  '3XL': 2599,
}

export const SHIRT_SHIPPING_FIRST_CENTS = 495
export const SHIRT_SHIPPING_ADDITIONAL_CENTS = 240
export const SHIRT_MIN_FROM_PRICE_CENTS = FRONT_ONLY_PRICE.S

export function shirtMockupPublicPath(slug: string, color: ShirtColor, side: 'front' | 'back'): string {
  return `/merch/shirts/${slug}-${color.toLowerCase()}-${side}.jpg`
}

export function listShirtProducts(): ShirtCatalogEntry[] {
  return catalog
}

export function getShirtBySlug(slug: string): ShirtCatalogEntry | null {
  return catalog.find((p) => p.slug === slug) ?? null
}

export function shirtPriceCents(entry: ShirtCatalogEntry, size: ShirtSize): number {
  const table = entry.back_print ? FRONT_BACK_PRICE : FRONT_ONLY_PRICE
  return table[size]
}

export function variantKey(size: ShirtSize, color: ShirtColor): string {
  return `${size} / ${color}`
}

export function resolvePrintifyVariantId(entry: ShirtCatalogEntry, size: ShirtSize, color: ShirtColor): number | null {
  const id = entry.variants[variantKey(size, color)]
  return typeof id === 'number' ? id : null
}

export type ValidatedShirtLine = {
  slug: string
  title: string
  color: ShirtColor
  size: ShirtSize
  quantity: number
  unitAmountCents: number
  printifyProductId: string
  printifyVariantId: number
  backPrint: boolean
  /** Girlfriend collection design key when `slug` is girlfriend-collection. */
  designId?: string
}

export function parseShirtSize(v: unknown): ShirtSize | null {
  return typeof v === 'string' && (SHIRT_SIZES as readonly string[]).includes(v) ? (v as ShirtSize) : null
}

export function parseShirtColor(v: unknown): ShirtColor | null {
  return typeof v === 'string' && (SHIRT_COLORS as readonly string[]).includes(v) ? (v as ShirtColor) : null
}

export function validateShirtCheckoutLine(input: {
  slug: unknown
  color: unknown
  size: unknown
  quantity: unknown
}): { ok: true; line: ValidatedShirtLine } | { ok: false; error: string } {
  const slug = typeof input.slug === 'string' ? input.slug.trim() : ''
  const entry = getShirtBySlug(slug)
  if (!entry) return { ok: false, error: 'Unknown product.' }

  const color = parseShirtColor(input.color)
  const size = parseShirtSize(input.size)
  if (!color || !size) return { ok: false, error: 'Invalid size or color.' }

  const variantId = resolvePrintifyVariantId(entry, size, color)
  if (variantId == null) return { ok: false, error: 'This combination is not available.' }

  const qtyRaw = input.quantity
  const quantity = typeof qtyRaw === 'number' && Number.isInteger(qtyRaw) ? qtyRaw : typeof qtyRaw === 'string' ? parseInt(qtyRaw, 10) : NaN
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 10) {
    return { ok: false, error: 'Quantity must be between 1 and 10.' }
  }

  return {
    ok: true,
    line: {
      slug: entry.slug,
      title: entry.title,
      color,
      size,
      quantity,
      unitAmountCents: shirtPriceCents(entry, size),
      printifyProductId: entry.printify_product_id,
      printifyVariantId: variantId,
      backPrint: entry.back_print,
    },
  }
}

export function shirtShippingCents(totalShirtQuantity: number): number {
  if (totalShirtQuantity < 1) return 0
  return SHIRT_SHIPPING_FIRST_CENTS + SHIRT_SHIPPING_ADDITIONAL_CENTS * (totalShirtQuantity - 1)
}

export function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export type PublicShirtProduct = {
  slug: string
  titleKey: string
  backPrint: boolean
  colors: ShirtColor[]
  sizes: ShirtSize[]
  fromPriceCents: number
  mockups: Partial<Record<`${ShirtColor}-${'front' | 'back'}`, string>>
}

/** Listing / card thumbnail color (default Black; White for tees whose lead art is on a light blank). */
const SHIRT_LEAD_LIST_COLOR_WHITE = new Set(['35-world-straight-after-the-freeplug'])

export function shirtLeadListColor(slug: string): ShirtColor {
  return SHIRT_LEAD_LIST_COLOR_WHITE.has(slug) ? 'White' : 'Black'
}

export function shirtDefaultSelectedColor(slug: string): ShirtColor {
  return shirtLeadListColor(slug)
}

export function shirtListCardFrontMockup(p: Pick<PublicShirtProduct, 'slug'>): {
  color: ShirtColor
  src: string
} {
  const color = shirtDefaultSelectedColor(p.slug)
  const src = shirtGarmentDisplayMockupSrc(p.slug, color, 'front')
  return { color, src }
}

const TITLE_KEYS: Record<string, string> = {
  '01-know-a-plug': 'shirt01',
  '02-circle-mark': 'shirt02',
  '03-get-plugged-in': 'shirt03',
  '04-free-game': 'shirt04',
  '05-website-was-free': 'shirt05',
  '06-day-one': 'shirt06',
}

export function listPublicShirtProducts(): PublicShirtProduct[] {
  return catalog.map((entry) => {
    const mockups: PublicShirtProduct['mockups'] = {}
    for (const color of SHIRT_COLORS) {
      mockups[`${color}-front`] = shirtGarmentDisplayMockupSrc(entry.slug, color, 'front')
      if (entry.back_print) {
        mockups[`${color}-back`] = shirtGarmentDisplayMockupSrc(entry.slug, color, 'back')
      }
    }
    const fromPriceCents = entry.back_print ? FRONT_BACK_PRICE.S : FRONT_ONLY_PRICE.S
    return {
      slug: entry.slug,
      titleKey: TITLE_KEYS[entry.slug] ?? entry.slug,
      backPrint: entry.back_print,
      colors: [...SHIRT_COLORS],
      sizes: [...SHIRT_SIZES],
      fromPriceCents,
      mockups,
    }
  })
}
