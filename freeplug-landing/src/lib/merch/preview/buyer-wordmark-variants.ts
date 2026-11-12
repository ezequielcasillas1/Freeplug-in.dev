import { BUYER_WORDMARK_BRAND_KEYS, buyerWordmarkBrandLabel, type BuyerWordmarkBrandKey } from './buyer-wordmark-brand'
import { BUYER_WORDMARK_STYLE_KEYS, buyerWordmarkStyleLabel, type BuyerWordmarkStyleKey } from './buyer-wordmark-style'
import { variationIdForBuyerWordmark } from './buyer-wordmark-variation'

/** 4 styles × 4 names — matches unpublished Printify draft matrix per SKU. */
export const BUYER_WORDMARK_VARIANT_COUNT =
  BUYER_WORDMARK_STYLE_KEYS.length * BUYER_WORDMARK_BRAND_KEYS.length

export type BuyerWordmarkVariant = {
  brand: BuyerWordmarkBrandKey
  style: BuyerWordmarkStyleKey
  variationId: string
  label: string
}

export function listBuyerWordmarkVariants(): BuyerWordmarkVariant[] {
  const out: BuyerWordmarkVariant[] = []
  for (const style of BUYER_WORDMARK_STYLE_KEYS) {
    for (const brand of BUYER_WORDMARK_BRAND_KEYS) {
      out.push({
        brand,
        style,
        variationId: variationIdForBuyerWordmark(brand, style),
        label: `${buyerWordmarkStyleLabel(style)} · ${buyerWordmarkBrandLabel(brand)}`,
      })
    }
  }
  return out
}
