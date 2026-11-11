import type { BrandNameKey } from './brand-names'
import type { BuyerWordmarkBrandKey } from './buyer-wordmark-brand'
import type { BuyerWordmarkStyleKey } from './buyer-wordmark-style'
import type { WordmarkTreatment } from './wordmark-variations'

export const BUYER_BRAND_NAME_KEY: Record<BuyerWordmarkBrandKey, BrandNameKey> = {
  'freeplug-dev': 'freeplug-dev',
  fplgn: 'fplgn',
  'freeplug-in-dev': 'freeplug-in-dev',
  'freeplug-in': 'freeplug-in',
}

/** Raster PNG art in public/merch/buyer-wordmark-art/ (not font/SVG stand-ins). */
export const BUYER_STYLE_TREATMENT: Record<BuyerWordmarkStyleKey, WordmarkTreatment> = {
  cursive: 'buyer-raster',
  'cursive-plate': 'buyer-raster',
  'pop-v2': 'buyer-raster',
  'pop-plate-v2': 'buyer-raster',
}

export function variationIdForBuyerWordmark(
  brand: BuyerWordmarkBrandKey,
  style: BuyerWordmarkStyleKey
): string {
  return `buyer-${style}-${brand}`
}

/** @deprecated Use variationIdForBuyerWordmark with default style. */
export function variationIdForBuyerWordmarkBrand(brand: BuyerWordmarkBrandKey): string {
  return variationIdForBuyerWordmark(brand, 'cursive')
}
