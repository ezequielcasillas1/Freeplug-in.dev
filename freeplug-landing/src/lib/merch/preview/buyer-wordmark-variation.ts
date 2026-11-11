import type { BuyerWordmarkBrandKey } from './buyer-wordmark-brand'

/** Print-surface treatments (no large panels) — one stable variation per buyer brand. */
export const BUYER_BRAND_PREVIEW_VARIATION_ID: Record<BuyerWordmarkBrandKey, string> = {
  'freeplug-dev': 'v19-fpd-chest-left',
  fplgn: 'v25-fplgn-stamp',
  'freeplug-in-dev': 'v03-fpid-outline',
  'freeplug-in': 'v21-fpin-outline',
}

export function variationIdForBuyerWordmarkBrand(brand: BuyerWordmarkBrandKey): string {
  return BUYER_BRAND_PREVIEW_VARIATION_ID[brand]
}
