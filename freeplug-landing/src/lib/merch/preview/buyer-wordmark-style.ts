/** Buyer-shop preview style sets (matches Printify draft naming: Cursive / Pop families). */
export const BUYER_WORDMARK_STYLE_KEYS = [
  'cursive',
  'cursive-plate',
  'pop-v2',
  'pop-plate-v2',
] as const

export type BuyerWordmarkStyleKey = (typeof BUYER_WORDMARK_STYLE_KEYS)[number]

export const DEFAULT_BUYER_WORDMARK_STYLE: BuyerWordmarkStyleKey = 'cursive'

const styleSet = new Set<string>(BUYER_WORDMARK_STYLE_KEYS)

export function isBuyerWordmarkStyleKey(v: string): v is BuyerWordmarkStyleKey {
  return styleSet.has(v)
}

export function parseBuyerWordmarkStyle(v: unknown): BuyerWordmarkStyleKey {
  if (typeof v === 'string' && isBuyerWordmarkStyleKey(v)) return v
  return DEFAULT_BUYER_WORDMARK_STYLE
}

export function buyerWordmarkStyleLabel(key: BuyerWordmarkStyleKey): string {
  switch (key) {
    case 'cursive':
      return 'Cursive'
    case 'cursive-plate':
      return 'Cursive Plate'
    case 'pop-v2':
      return 'Pop v2'
    case 'pop-plate-v2':
      return 'Pop Plate v2'
    default:
      return key
  }
}
