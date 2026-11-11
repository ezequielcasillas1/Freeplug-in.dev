import { BUYER_WORDMARK_BRAND_KEYS } from './buyer-wordmark-brand'
import {
  BUYER_BRAND_NAME_KEY,
  BUYER_STYLE_TREATMENT,
  variationIdForBuyerWordmark,
} from './buyer-wordmark-variation'
import { BUYER_WORDMARK_STYLE_KEYS, buyerWordmarkStyleLabel } from './buyer-wordmark-style'
import type { WordmarkVariationDef } from './wordmark-variations'

function buildBuyerWordmarkVariations(): WordmarkVariationDef[] {
  const out: WordmarkVariationDef[] = []
  for (const style of BUYER_WORDMARK_STYLE_KEYS) {
    for (const brand of BUYER_WORDMARK_BRAND_KEYS) {
      out.push({
        id: variationIdForBuyerWordmark(brand, style),
        nameKey: BUYER_BRAND_NAME_KEY[brand],
        treatment: BUYER_STYLE_TREATMENT[style],
        treatmentLabel: `${buyerWordmarkStyleLabel(style)} · ${brand}`,
      })
    }
  }
  return out
}

export const BUYER_WORDMARK_VARIATIONS = buildBuyerWordmarkVariations()

const buyerById = new Map(BUYER_WORDMARK_VARIATIONS.map((v) => [v.id, v]))

export function getBuyerWordmarkVariationDef(id: string): WordmarkVariationDef | null {
  return buyerById.get(id) ?? null
}
