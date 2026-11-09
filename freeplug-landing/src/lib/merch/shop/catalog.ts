import shopCatalog from './shop-catalog.json'
import printifyProducts from './printify-products.json'
import type { ShopCard, ShopCatalogItem, ShopTabSlug, ShopVariant } from './types'
import { MERCH_SHOP_FREE_SHIPPING_THRESHOLD_CENTS } from './types'

type RawCatalog = { items: ShopCatalogItem[] }

const RAW = shopCatalog as RawCatalog
const ALL_ITEMS: ShopCatalogItem[] = RAW.items

export function shopItemCount(): number {
  return ALL_ITEMS.length
}

export function listShopItems(): ShopCatalogItem[] {
  return ALL_ITEMS
}

export function listShopCards(tab?: ShopTabSlug): ShopCard[] {
  const items = tab ? ALL_ITEMS.filter((i) => i.tab === tab) : ALL_ITEMS
  return items.map((i) => ({
    slug: i.slug,
    title: i.title,
    tab: i.tab,
    productType: i.productType,
    category: i.category,
    fromRetailCents: i.fromRetailCents,
    featuredRank: i.featuredRank,
    placeholder: i.placeholder,
    colors: i.colors,
    gridImage: i.gridImage,
  }))
}

export function getShopItem(slug: string): ShopCatalogItem | null {
  return ALL_ITEMS.find((i) => i.slug === slug) ?? null
}

export function resolveShopVariant(item: ShopCatalogItem, variantId: number): ShopVariant | null {
  return item.variants.find((v) => v.id === variantId) ?? null
}

export function shopProductImageSrc(item: ShopCatalogItem, index = 0): string {
  return item.gallery[index] ?? item.gridImage ?? '/merch/shop/placeholder-product.svg'
}

export function shopShippingCents(item: ShopCatalogItem, quantity: number, unitAmountCents: number): number {
  if (quantity < 1) return 0
  const merchandiseSubtotalCents = unitAmountCents * quantity
  if (merchandiseSubtotalCents > MERCH_SHOP_FREE_SHIPPING_THRESHOLD_CENTS) return 0
  return item.shippingFirstCents + item.shippingAdditionalCents * (quantity - 1)
}

export function printifyProductIdForSlug(slug: string): string | null {
  const row = (printifyProducts as { bySlug: Record<string, { printifyProductId: string | null }> }).bySlug[slug]
  const id = row?.printifyProductId
  return id?.trim() ? id.trim() : null
}

export type ValidatedShopLine =
  | { ok: true; line: ShopCheckoutLine }
  | { ok: false; error: string }

export type ShopDesignMode = 'freeplug' | 'custom'

export type ShopCheckoutLine = {
  slug: string
  variantId: number
  quantity: number
  unitAmountCents: number
  designMode: ShopDesignMode
  customUploadPath?: string
  customPlacement?: { x: number; y: number; scale: number }
  printifyProductId: string | null
  printifyVariantId: number
  title: string
  optionLabel: string
  shippingFirstCents: number
  shippingAdditionalCents: number
  customFeeCents: number
}

type ValidateBody = {
  slug?: unknown
  variant_id?: unknown
  quantity?: unknown
  design_mode?: unknown
  custom_upload_path?: unknown
  custom_placement?: unknown
  rights_confirmed?: unknown
}

export function validateShopCheckoutLine(
  body: ValidateBody,
  customFeeCents: number
): ValidatedShopLine {
  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const item = getShopItem(slug)
  if (!item) return { ok: false, error: 'Unknown product.' }

  const variantId =
    typeof body.variant_id === 'number' ? body.variant_id : parseInt(String(body.variant_id ?? ''), 10)
  const variant = resolveShopVariant(item, variantId)
  if (!variant) return { ok: false, error: 'Unknown variant.' }

  const quantity =
    typeof body.quantity === 'number' ? body.quantity : parseInt(String(body.quantity ?? '1'), 10)
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 20) {
    return { ok: false, error: 'Invalid quantity.' }
  }

  const designMode = body.design_mode === 'custom' ? 'custom' : 'freeplug'
  if (designMode === 'custom') {
    if (body.rights_confirmed !== true) {
      return { ok: false, error: 'Rights confirmation required.' }
    }
    const uploadPath = typeof body.custom_upload_path === 'string' ? body.custom_upload_path.trim() : ''
    if (!uploadPath.startsWith('merch-shop-uploads/')) {
      return { ok: false, error: 'Custom artwork upload missing.' }
    }
  }

  const printifyProductId = designMode === 'freeplug' ? printifyProductIdForSlug(slug) : null
  if (designMode === 'freeplug' && !printifyProductId) {
    return { ok: false, error: 'This item is not available for purchase yet.' }
  }

  const customFee = designMode === 'custom' ? customFeeCents : 0
  const unitAmountCents = variant.retailCents + customFee
  const optionLabel = variant.title ?? `${variant.color ?? ''} ${variant.size ?? ''}`.trim()

  let customPlacement: { x: number; y: number; scale: number } | undefined
  if (designMode === 'custom' && body.custom_placement && typeof body.custom_placement === 'object') {
    const p = body.custom_placement as { x?: unknown; y?: unknown; scale?: unknown }
    const x = Number(p.x)
    const y = Number(p.y)
    const scale = Number(p.scale)
    if ([x, y, scale].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) {
      customPlacement = { x, y, scale }
    }
  }

  return {
    ok: true,
    line: {
      slug,
      variantId,
      quantity,
      unitAmountCents,
      designMode,
      customUploadPath:
        designMode === 'custom' && typeof body.custom_upload_path === 'string'
          ? body.custom_upload_path.trim()
          : undefined,
      customPlacement,
      printifyProductId,
      printifyVariantId: variant.id,
      title: item.title,
      optionLabel,
      shippingFirstCents: item.shippingFirstCents,
      shippingAdditionalCents: item.shippingAdditionalCents,
      customFeeCents: customFee,
    },
  }
}
