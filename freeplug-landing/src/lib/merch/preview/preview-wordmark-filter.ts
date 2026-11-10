import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { BRAND_NAME_KEYS, type BrandNameKey } from './brand-names'
import { getWordmarkVariation } from './wordmark-variations'
import { resolvePreviewWordmark, type ResolvePreviewWordmarkInput } from './preview-wordmark-resolve'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'

export function catalogKeyToSlug(key: string): string {
  const slash = key.indexOf('/')
  return slash >= 0 ? key.slice(slash + 1) : key
}

export function resolveInputFromCatalogItem(item: CatalogFilterItem): ResolvePreviewWordmarkInput {
  return {
    source: item.source,
    slug: catalogKeyToSlug(item.key),
    href: item.href,
    productType: item.productType,
    catalogKey: item.key,
    garmentColor: item.colors[0] ?? null,
  }
}

export function isRectangularStyleCatalogItem(item: CatalogFilterItem): boolean {
  if (item.source !== 't-shirts') return false
  return isSupremeStyleShirtSlug(catalogKeyToSlug(item.key))
}

export function previewBrandNameKeyForItem(item: CatalogFilterItem): BrandNameKey | null {
  const resolved = resolvePreviewWordmark(resolveInputFromCatalogItem(item))
  if (!resolved) return null
  const variation = getWordmarkVariation(resolved.variationId)
  return variation?.nameKey ?? null
}

export function matchesPreviewWordmarkCatalogFilters(
  item: CatalogFilterItem,
  rectangularStyleOnly: boolean,
  brandNameKeys: BrandNameKey[]
): boolean {
  if (rectangularStyleOnly && !isRectangularStyleCatalogItem(item)) return false
  if (brandNameKeys.length) {
    const key = previewBrandNameKeyForItem(item)
    if (!key || !brandNameKeys.includes(key)) return false
  }
  return true
}

export type PreviewWordmarkFacets = {
  brandNames: Record<BrandNameKey, number>
  rectangularStyle: number
}

export function computePreviewWordmarkFacets(items: CatalogFilterItem[]): PreviewWordmarkFacets {
  const brandNames = Object.fromEntries(BRAND_NAME_KEYS.map((k) => [k, 0])) as Record<BrandNameKey, number>
  let rectangularStyle = 0
  for (const item of items) {
    if (isRectangularStyleCatalogItem(item)) rectangularStyle += 1
    const nk = previewBrandNameKeyForItem(item)
    if (nk) brandNames[nk] += 1
  }
  return { brandNames, rectangularStyle }
}

export function isBrandNameKey(v: string): v is BrandNameKey {
  return (BRAND_NAME_KEYS as readonly string[]).includes(v)
}
