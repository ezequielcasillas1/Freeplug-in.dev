import { getPrintifySlugRow, pickFrontPrintifyMockup } from './printify-catalog'

/** Printify product photo with legacy baked logo — not for buyer-shop display. */
export function shopBrandedListingImage(slug: string): string | null {
  const row = getPrintifySlugRow(slug)
  if (!row?.mockupsByColor) return null
  const keys = Object.keys(row.mockupsByColor)
  if (!keys.length) return null
  const colorKey = keys.includes('default') ? 'default' : keys[0]!
  const urls = row.mockupsByColor[colorKey]
  if (!urls?.length) return null
  return pickFrontPrintifyMockup(urls) ?? urls[0] ?? null
}

const PRINTIFY_MOCKUP = /^https:\/\/images-api\.printify\.com\//i

/** Public grid/PDP heroes use logo-free local blanks only (cursive overlay is separate). */
export function shopListingImageSrc(_slug: string, blankGridImage: string): string {
  return blankGridImage
}

export function isRemoteShopImage(src: string): boolean {
  return /^https?:\/\//i.test(src)
}

export function isPrintifyMockupImageSrc(src: string): boolean {
  return PRINTIFY_MOCKUP.test(src)
}
