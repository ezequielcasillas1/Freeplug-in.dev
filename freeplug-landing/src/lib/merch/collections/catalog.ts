import rawCatalog from './collections-catalog.json'
import { merchShippingCents, type MerchShippingClass } from './shipping'

export const MERCH_COLLECTION_CHECKOUT_TYPE = 'merch_collection_product' as const
export const MERCH_CURRENCY = 'usd' as const

export const MERCH_COLLECTIONS = ['drinkware', 'hats', 'apparel', 'home-faith', 'desk-extras'] as const
export type MerchCollectionSlug = (typeof MERCH_COLLECTIONS)[number]

export const CREWNECK_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'] as const
export const CREWNECK_COLORS = ['Black', 'White', 'Sand'] as const
export type CrewneckSize = (typeof CREWNECK_SIZES)[number]
export type CrewneckColor = (typeof CREWNECK_COLORS)[number]

type CatalogOptionRow = {
  key: string
  printify_variant_id: number
  price_cents: number
  shipping_class?: MerchShippingClass
}

export type MerchCatalogEntry = {
  slug: string
  collection: MerchCollectionSlug
  title: string
  title_key: string
  printify_product_id: string
  shipping_class: MerchShippingClass
  mockup: string
  options: CatalogOptionRow[]
}

const CREWNECK_VARIANT_IDS: Record<CrewneckSize, Record<CrewneckColor, number>> = {
  S: { Sand: 25394, White: 25396, Black: 25397 },
  M: { Sand: 25425, White: 25427, Black: 25428 },
  L: { Sand: 25456, White: 25458, Black: 25459 },
  XL: { Sand: 25487, White: 25489, Black: 25490 },
  '2XL': { Sand: 25518, White: 25520, Black: 25521 },
  '3XL': { Sand: 25549, White: 25551, Black: 25552 },
}

const CREWNECK_PRICE: Record<CrewneckSize, number> = {
  S: 4899,
  M: 4899,
  L: 4899,
  XL: 4899,
  '2XL': 5399,
  '3XL': 5599,
}

function injectCrewneckOptions(entry: MerchCatalogEntry): MerchCatalogEntry {
  if (entry.slug !== 'hero-crewneck') return entry
  const options: CatalogOptionRow[] = []
  for (const size of CREWNECK_SIZES) {
    for (const color of CREWNECK_COLORS) {
      options.push({
        key: `${size} / ${color}`,
        printify_variant_id: CREWNECK_VARIANT_IDS[size][color],
        price_cents: CREWNECK_PRICE[size],
      })
    }
  }
  return { ...entry, options }
}

const catalog = (rawCatalog as MerchCatalogEntry[]).map(injectCrewneckOptions)

export function listMerchCollections(): MerchCollectionSlug[] {
  return [...MERCH_COLLECTIONS]
}

export function listCatalogProducts(): MerchCatalogEntry[] {
  return catalog
}

export function listProductsByCollection(collection: MerchCollectionSlug): MerchCatalogEntry[] {
  return catalog.filter((p) => p.collection === collection)
}

export function getCatalogProduct(slug: string): MerchCatalogEntry | null {
  return catalog.find((p) => p.slug === slug) ?? null
}

export function getCatalogProductInCollection(collection: string, slug: string): MerchCatalogEntry | null {
  const entry = getCatalogProduct(slug)
  if (!entry || entry.collection !== collection) return null
  return entry
}

export function collectionMockupPublicPath(collection: MerchCollectionSlug, mockupFile: string): string {
  return `/merch/${collection}/${mockupFile}`
}

export function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function resolveCatalogOption(entry: MerchCatalogEntry, optionKey: string): CatalogOptionRow | null {
  return entry.options.find((o) => o.key === optionKey) ?? null
}

export function optionShippingClass(entry: MerchCatalogEntry, option: CatalogOptionRow): MerchShippingClass {
  return option.shipping_class ?? entry.shipping_class
}

export type ValidatedCollectionLine = {
  collection: MerchCollectionSlug
  slug: string
  title: string
  optionKey: string
  optionLabel: string
  quantity: number
  unitAmountCents: number
  shippingClass: MerchShippingClass
  printifyProductId: string
  printifyVariantId: number
}

export function parseCrewneckSize(v: unknown): CrewneckSize | null {
  return typeof v === 'string' && (CREWNECK_SIZES as readonly string[]).includes(v) ? (v as CrewneckSize) : null
}

export function parseCrewneckColor(v: unknown): CrewneckColor | null {
  return typeof v === 'string' && (CREWNECK_COLORS as readonly string[]).includes(v) ? (v as CrewneckColor) : null
}

export function validateCollectionCheckoutLine(input: {
  collection: unknown
  slug: unknown
  option_key?: unknown
  size?: unknown
  color?: unknown
  quantity: unknown
}): { ok: true; line: ValidatedCollectionLine } | { ok: false; error: string } {
  const collection =
    typeof input.collection === 'string' && (MERCH_COLLECTIONS as readonly string[]).includes(input.collection)
      ? (input.collection as MerchCollectionSlug)
      : null
  const slug = typeof input.slug === 'string' ? input.slug.trim() : ''
  if (!collection || !slug) return { ok: false, error: 'Unknown product.' }

  const entry = getCatalogProductInCollection(collection, slug)
  if (!entry) return { ok: false, error: 'Unknown product.' }

  let optionKey = typeof input.option_key === 'string' ? input.option_key.trim() : ''
  if (entry.slug === 'hero-crewneck') {
    const size = parseCrewneckSize(input.size)
    const color = parseCrewneckColor(input.color)
    if (!size || !color) return { ok: false, error: 'Invalid size or color.' }
    optionKey = `${size} / ${color}`
  } else if (!optionKey && entry.options.length === 1) {
    optionKey = entry.options[0]!.key
  }
  if (!optionKey) return { ok: false, error: 'Choose an option.' }

  const option = resolveCatalogOption(entry, optionKey)
  if (!option) return { ok: false, error: 'This option is not available.' }

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

  const shippingClass = optionShippingClass(entry, option)

  return {
    ok: true,
    line: {
      collection,
      slug: entry.slug,
      title: entry.title,
      optionKey: option.key,
      optionLabel: option.key,
      quantity,
      unitAmountCents: option.price_cents,
      shippingClass,
      printifyProductId: entry.printify_product_id,
      printifyVariantId: option.printify_variant_id,
    },
  }
}

export function collectionLineShippingCents(line: ValidatedCollectionLine): number {
  return merchShippingCents(line.shippingClass, line.quantity)
}

export type PublicCollectionProduct = {
  slug: string
  titleKey: string
  fromPriceCents: number
  mockupSrc: string
  optionKeys: string[]
  isCrewneck: boolean
}

export function listPublicCollectionProducts(collection: MerchCollectionSlug): PublicCollectionProduct[] {
  return listProductsByCollection(collection).map((entry) => {
    const prices = entry.options.map((o) => o.price_cents)
    const fromPriceCents = prices.length ? Math.min(...prices) : 0
    return {
      slug: entry.slug,
      titleKey: entry.title_key,
      fromPriceCents,
      mockupSrc: collectionMockupPublicPath(collection, entry.mockup),
      optionKeys: entry.options.map((o) => o.key),
      isCrewneck: entry.slug === 'hero-crewneck',
    }
  })
}

export function crewneckUnitPriceCents(size: CrewneckSize): number {
  return CREWNECK_PRICE[size]
}
