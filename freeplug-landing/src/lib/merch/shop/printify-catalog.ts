import printifyProducts from './printify-products.json'

export const SHOP_FREEPLUG_COMING_SOON_SLUGS = [
  'fanny-pack-468',
  'glass-cutting-board-938',
  'garden-house-banner-976',
  'matte-canvas-stretched-1-25-1159',
  'metal-art-sign-1206',
  'matte-canvas-stretched-0-75-multi-size-937',
] as const

export type PrintifyVariantRow = {
  id: number
  productId: string | null
  color: string | null
  size: string | null
  priceCents: number | null
  enabled: boolean
}

export type PrintifySlugRow = {
  printifyProductId: string | null
  printifyProductIds: string[]
  productIdByVariant: Record<string, string>
  variants: PrintifyVariantRow[]
  mockupsByColor: Record<string, string[]>
}

type PrintifyDb = { bySlug: Record<string, PrintifySlugRow> }

const DB = printifyProducts as PrintifyDb

export function getPrintifySlugRow(slug: string): PrintifySlugRow | null {
  return DB.bySlug[slug] ?? null
}

export function isFreeplugShopComingSoon(slug: string): boolean {
  return (SHOP_FREEPLUG_COMING_SOON_SLUGS as readonly string[]).includes(slug)
}

export function shopHasPrintifyFreeplug(slug: string): boolean {
  if (isFreeplugShopComingSoon(slug)) return false
  const row = getPrintifySlugRow(slug)
  if (!row?.printifyProductId) return false
  return Object.keys(row.productIdByVariant ?? {}).length > 0
}

export function printifyProductIdForVariant(slug: string, variantId: number): string | null {
  const row = getPrintifySlugRow(slug)
  if (!row) return null
  const fromMap = row.productIdByVariant?.[String(variantId)]
  if (fromMap?.trim()) return fromMap.trim()
  const v = row.variants?.find((x) => x.id === variantId)
  const id = v?.productId
  return id?.trim() ? id.trim() : row.printifyProductId?.trim() || null
}

/** @deprecated Prefer printifyProductIdForVariant at checkout. */
export function printifyProductIdForSlug(slug: string): string | null {
  return getPrintifySlugRow(slug)?.printifyProductId?.trim() || null
}

export function mockupsForShopColor(slug: string, color: string | null | undefined): string[] {
  if (!color) return []
  const row = getPrintifySlugRow(slug)
  if (!row?.mockupsByColor) return []
  const exact = row.mockupsByColor[color]
  if (exact?.length) return exact
  const key = Object.keys(row.mockupsByColor).find((k) => k.toLowerCase() === color.toLowerCase())
  return key ? row.mockupsByColor[key] ?? [] : []
}

export function pickFrontPrintifyMockup(urls: string[]): string | null {
  if (!urls.length) return null
  const front = urls.find((u) => /camera_label=front/.test(u))
  return front ?? urls[0]
}

export function shopHasColorMockups(slug: string): boolean {
  const row = getPrintifySlugRow(slug)
  return Boolean(row?.mockupsByColor && Object.keys(row.mockupsByColor).length > 0)
}
