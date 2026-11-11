import type { CatalogSource } from '@/lib/merch/catalog-filter-types'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { catalogShirtSkipsPreviewWordmarkOverlay, isPlainCatalogGarment } from './preview-overlay-eligibility'
import { inferProductTypeFromCatalog, placementForProductType, type PreviewPlacement } from './placement-defaults'
import {
  DEFAULT_BUYER_WORDMARK_BRAND,
  parseBuyerWordmarkBrand,
  type BuyerWordmarkBrandKey,
} from './buyer-wordmark-brand'
import {
  DEFAULT_BUYER_WORDMARK_STYLE,
  parseBuyerWordmarkStyle,
  type BuyerWordmarkStyleKey,
} from './buyer-wordmark-style'
import { variationIdForBuyerWordmark } from './buyer-wordmark-variation'
import { buyerShopUsesPreviewWordmarkOverlay } from './preview-overlay-eligibility'
import { classifyBlankColor } from '@/lib/merch/shop/contrast'
import { stableCatalogIndex, variationIdForStableIndex } from './wordmark-variations'

export type PreviewWordmarkMode = 'full' | 'skip'

export type ResolvedPreviewWordmark = {
  variationId: string
  placement: PreviewPlacement
  blankKind: 'light' | 'dark'
  mode: PreviewWordmarkMode
  /** SVG wordmark only — no large Cover panels (print-like on mockup). */
  printSurface?: boolean
  /** Compact overlay layout (e.g. small badge treatment on plain garments). */
  chestBadge?: boolean
}

const DIGITAL_HREFS = new Set(['/merch/freeplug-font-bundle', '/merch/fonts-personal-use'])

const GIVING_CAMPAIGN_SHIRT_SLUGS = new Set([
  '01-know-a-plug',
  '02-circle-mark',
  '03-get-plugged-in',
  '04-free-game',
  '05-website-was-free',
  '06-day-one',
])

export function isVerseShirtSlug(slug: string): boolean {
  return /^\d{2}-verse-/.test(slug)
}

export function isDigitalMerchHref(href: string): boolean {
  return DIGITAL_HREFS.has(href)
}

export function isGivingCampaignShirtSlug(slug: string): boolean {
  return GIVING_CAMPAIGN_SHIRT_SLUGS.has(slug)
}

/** @deprecated Prefer `classifyBlankColor` or `resolveShopPreviewBlankKind` for shop mockups. */
export function blankKindFromColor(color: string | undefined): 'light' | 'dark' {
  return classifyBlankColor(color ?? null)
}

export function shirtColorFromBlank(blank: 'light' | 'dark'): ShirtColor {
  return blank === 'light' ? 'White' : 'Black'
}

export type ResolvePreviewWordmarkInput = {
  source: CatalogSource | null
  slug: string
  href: string
  productType: string | null
  /** Stable list key (`tshirts/foo`, `shop/bar`, `drinkware/baz`) */
  catalogKey: string
  garmentColor?: string | null
  /** Buyer-shop: brand + style for the single preview overlay. */
  buyerWordmarkBrand?: BuyerWordmarkBrandKey | null
  buyerWordmarkStyle?: BuyerWordmarkStyleKey | null
  /** When set (buyer-shop), ink follows the visible mockup, not only the color label. */
  garmentBlankKind?: 'light' | 'dark' | null
}

export function resolvePreviewWordmark(input: ResolvePreviewWordmarkInput): ResolvedPreviewWordmark | null {
  if (isDigitalMerchHref(input.href)) return null
  if (catalogShirtSkipsPreviewWordmarkOverlay(input.source)) {
    return null
  }

  if (buyerShopUsesPreviewWordmarkOverlay(input.source)) {
    const productType = inferProductTypeFromCatalog(input.slug, input.productType, input.catalogKey)
    const brand = parseBuyerWordmarkBrand(input.buyerWordmarkBrand ?? DEFAULT_BUYER_WORDMARK_BRAND)
    const style = parseBuyerWordmarkStyle(input.buyerWordmarkStyle ?? DEFAULT_BUYER_WORDMARK_STYLE)
    const plateStyle = style === 'cursive-plate' || style === 'pop-plate-v2'
  const blankKind =
      input.garmentBlankKind ??
      (input.garmentColor ? classifyBlankColor(input.garmentColor) : 'light')
    return {
      variationId: variationIdForBuyerWordmark(brand, style),
      placement: placementForProductType(productType),
      blankKind,
      mode: 'full',
      printSurface: !plateStyle,
    }
  }

  if (isPlainCatalogGarment(input.source)) {
    const productType = inferProductTypeFromCatalog(input.slug, input.productType, input.catalogKey)
    return {
      variationId: variationIdForStableIndex(stableCatalogIndex(input.catalogKey) + 7),
      placement: placementForProductType(productType),
      blankKind: input.garmentColor ? blankKindFromColor(input.garmentColor) : 'dark',
      mode: 'full',
    }
  }

  return null
}
