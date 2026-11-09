import { getPrintifySlugRow, pickFrontPrintifyMockup } from './printify-catalog'

/** First Freeplug mockup for grid cards (default color, else first color bucket). */
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

export function shopListingImageSrc(slug: string, blankGridImage: string): string {
  return shopBrandedListingImage(slug) ?? blankGridImage
}

export function isRemoteShopImage(src: string): boolean {
  return /^https?:\/\//i.test(src)
}
