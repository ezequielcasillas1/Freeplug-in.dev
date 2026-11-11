import type { BuyerWordmarkBrandKey } from './buyer-wordmark-brand'
import type { BuyerWordmarkStyleKey } from './buyer-wordmark-style'
import { isBuyerWordmarkBrandKey } from './buyer-wordmark-brand'
import { isBuyerWordmarkStyleKey } from './buyer-wordmark-style'

/** Folder names inside `public/merch/buyer-wordmark-art/`. */
export const BUYER_WORDMARK_ART_DIR: Record<BuyerWordmarkStyleKey, string> = {
  cursive: 'cursive',
  'cursive-plate': 'cursive-plate',
  'pop-v2': 'pop-v2',
  'pop-plate-v2': 'pop-plate-v2',
}

/** Print-file label segment (matches Printify draft titles). */
export const BUYER_WORDMARK_ART_LABEL: Record<BuyerWordmarkBrandKey, string> = {
  'freeplug-dev': 'Freeplug.dev',
  fplgn: 'FPLGN',
  'freeplug-in-dev': 'Freeplug-in.dev',
  'freeplug-in': 'Freeplug.in',
}

/**
 * Garment ink suffix on ingested PNGs:
 * `on-light` = dark ink art (kit `*-dark.png`) on light garments;
 * `on-dark`  = light ink art (kit `*-light.png`) on dark garments.
 */
export function buyerWordmarkInkSuffix(blankKind: 'light' | 'dark'): 'on-light' | 'on-dark' {
  return blankKind === 'light' ? 'on-light' : 'on-dark'
}

export function buyerWordmarkArtPublicPath(
  style: BuyerWordmarkStyleKey,
  brand: BuyerWordmarkBrandKey,
  blankKind: 'light' | 'dark'
): string {
  const ink = buyerWordmarkInkSuffix(blankKind)
  const folder = BUYER_WORDMARK_ART_DIR[style]
  const label = BUYER_WORDMARK_ART_LABEL[brand]
  return `/merch/buyer-wordmark-art/${folder}/${label}-${ink}.png`
}

const BUYER_VARIATION_RE =
  /^buyer-(cursive-plate|pop-plate-v2|cursive|pop-v2)-(freeplug-dev|fplgn|freeplug-in-dev|freeplug-in)$/

export function parseBuyerWordmarkVariationId(
  variationId: string
): { style: BuyerWordmarkStyleKey; brand: BuyerWordmarkBrandKey } | null {
  const m = BUYER_VARIATION_RE.exec(variationId)
  if (!m) return null
  const style = m[1]!
  const brand = m[2]!
  if (!isBuyerWordmarkStyleKey(style) || !isBuyerWordmarkBrandKey(brand)) return null
  return { style, brand }
}
