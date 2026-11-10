import type { CatalogSource } from '@/lib/merch/catalog-filter-types'
import { getSupremePreviewSpec, isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'
import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { inferProductTypeFromCatalog, placementForProductType, type PreviewPlacement } from './placement-defaults'
import { stableCatalogIndex, variationIdForStableIndex } from './wordmark-variations'

export type PreviewWordmarkMode = 'full' | 'skip'

export type ResolvedPreviewWordmark = {
  variationId: string
  placement: PreviewPlacement
  blankKind: 'light' | 'dark'
  mode: PreviewWordmarkMode
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
}

export function resolvePreviewWordmark(input: ResolvePreviewWordmarkInput): ResolvedPreviewWordmark | null {
  if (isDigitalMerchHref(input.href)) return null
  if (input.source === 't-shirts') {
    if (isVerseShirtSlug(input.slug) || isGivingCampaignShirtSlug(input.slug)) {
      return null
    }
    if (isSupremeStyleShirtSlug(input.slug)) {
      const spec = getSupremePreviewSpec(input.slug)!
      const blank =
        input.garmentColor != null ? blankKindFromColor(input.garmentColor) : 'dark'
      return {
        variationId: spec.variationId,
        placement: {
          top: spec.placement.top,
          left: 0.5,
          width: spec.placement.width,
          scale: spec.placement.width * 2.65,
        },
        blankKind: blank,
        mode: 'full',
      }
    }
    const idx = stableCatalogIndex(input.catalogKey)
    return {
      variationId: variationIdForStableIndex(idx),
      placement: placementForProductType('t-shirt'),
      blankKind: input.garmentColor ? blankKindFromColor(input.garmentColor) : 'dark',
      mode: 'full',
    }
  }

  if (input.source === 'buyer-shop' || input.source === 'merch-store') {
    const idx = stableCatalogIndex(input.catalogKey)
    const productType = inferProductTypeFromCatalog(input.slug, input.productType, input.catalogKey)
    return {
      variationId: variationIdForStableIndex(idx + 7),
      placement: placementForProductType(productType),
      blankKind: input.garmentColor ? blankKindFromColor(input.garmentColor) : 'dark',
      mode: 'full',
    }
  }

  return null
}
