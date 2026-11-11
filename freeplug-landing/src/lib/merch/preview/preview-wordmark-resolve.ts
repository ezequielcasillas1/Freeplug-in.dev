import type { CatalogSource } from '@/lib/merch/catalog-filter-types'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { catalogShirtSkipsPreviewWordmarkOverlay, isPlainCatalogGarment } from './preview-overlay-eligibility'
import { inferProductTypeFromCatalog, placementForProductType, type PreviewPlacement } from './placement-defaults'
import {
  DEFAULT_BUYER_WORDMARK_BRAND,
  parseBuyerWordmarkBrand,
  type BuyerWordmarkBrandKey,
} from './buyer-wordmark-brand'
import { variationIdForBuyerWordmarkBrand } from './buyer-wordmark-variation'
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

export function blankKindFromColor(color: string | undefined): 'light' | 'dark' {
  if (!color) return 'dark'
  const c = color.toLowerCase()
  if (c === 'white' || c === 'natural' || c.includes('light') || c === 'sand') return 'light'
  return 'dark'
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
  /** When set, preview uses the buyer-selected brand (four plain-garment options). */
  buyerWordmarkBrand?: BuyerWordmarkBrandKey | null
}

export function resolvePreviewWordmark(input: ResolvePreviewWordmarkInput): ResolvedPreviewWordmark | null {
  if (isDigitalMerchHref(input.href)) return null
  if (catalogShirtSkipsPreviewWordmarkOverlay(input.source)) {
    return null
  }

  if (isPlainCatalogGarment(input.source)) {
    const productType = inferProductTypeFromCatalog(input.slug, input.productType, input.catalogKey)
    const buyerBrand = input.buyerWordmarkBrand ?? DEFAULT_BUYER_WORDMARK_BRAND
    const variationId =
      input.buyerWordmarkBrand != null
        ? variationIdForBuyerWordmarkBrand(parseBuyerWordmarkBrand(buyerBrand))
        : variationIdForStableIndex(stableCatalogIndex(input.catalogKey) + 7)
    return {
      variationId,
      placement: placementForProductType(productType),
      blankKind: input.garmentColor ? blankKindFromColor(input.garmentColor) : 'dark',
      mode: 'full',
      printSurface: input.buyerWordmarkBrand != null,
    }
  }

  return null
}
