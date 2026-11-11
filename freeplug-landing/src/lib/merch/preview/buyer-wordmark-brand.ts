import { getBrandNameLabel, type BrandNameKey } from './brand-names'

/** Four buyer-selectable wordmarks on plain catalog garments (preview + order metadata). */
export const BUYER_WORDMARK_BRAND_KEYS = [
  'freeplug-dev',
  'fplgn',
  'freeplug-in-dev',
  'freeplug-in',
] as const

export type BuyerWordmarkBrandKey = (typeof BUYER_WORDMARK_BRAND_KEYS)[number]

export const DEFAULT_BUYER_WORDMARK_BRAND: BuyerWordmarkBrandKey = 'freeplug-dev'

const buyerBrandSet = new Set<string>(BUYER_WORDMARK_BRAND_KEYS)

export function isBuyerWordmarkBrandKey(v: string): v is BuyerWordmarkBrandKey {
  return buyerBrandSet.has(v)
}

export function parseBuyerWordmarkBrand(v: unknown): BuyerWordmarkBrandKey {
  if (typeof v === 'string' && isBuyerWordmarkBrandKey(v)) return v
  return DEFAULT_BUYER_WORDMARK_BRAND
}

export function buyerWordmarkBrandLabel(key: BuyerWordmarkBrandKey): string {
  return getBrandNameLabel(key)
}

export function buyerWordmarkBrandKeyFromBrandName(key: BrandNameKey): BuyerWordmarkBrandKey | null {
  if (isBuyerWordmarkBrandKey(key)) return key
  return null
}
