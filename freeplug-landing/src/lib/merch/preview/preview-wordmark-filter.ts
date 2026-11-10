import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { BRAND_NAME_KEYS, type BrandNameKey } from './brand-names'
import { getWordmarkVariation } from './wordmark-variations'
import { resolvePreviewWordmark, type ResolvePreviewWordmarkInput } from './preview-wordmark-resolve'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'
import {
  isWordmarkStyleGroup,
  styleGroupForTreatment,
  WORDMARK_STYLE_GROUPS,
  type WordmarkStyleGroup,
} from './wordmark-style-groups'

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

export function previewStyleGroupForItem(item: CatalogFilterItem): WordmarkStyleGroup | null {
  const resolved = resolvePreviewWordmark(resolveInputFromCatalogItem(item))
  if (!resolved) return null
  const variation = getWordmarkVariation(resolved.variationId)
  if (!variation) return null
  return styleGroupForTreatment(variation.treatment)
}

export function matchesPreviewWordmarkCatalogFilters(
  item: CatalogFilterItem,
  rectangularStyleOnly: boolean,
  brandNameKeys: BrandNameKey[],
  wordmarkStyleGroups: WordmarkStyleGroup[]
): boolean {
  if (rectangularStyleOnly && !isRectangularStyleCatalogItem(item)) return false
  if (brandNameKeys.length) {
    const key = previewBrandNameKeyForItem(item)
    if (!key || !brandNameKeys.includes(key)) return false
  }
  if (wordmarkStyleGroups.length) {
    const group = previewStyleGroupForItem(item)
    if (!group || !wordmarkStyleGroups.includes(group)) return false
  }
  return true
}

export type PreviewWordmarkFacets = {
  brandNames: Record<BrandNameKey, number>
  rectangularStyle: number
  styles: Record<WordmarkStyleGroup, number>
}

export function computePreviewWordmarkFacets(items: CatalogFilterItem[]): PreviewWordmarkFacets {
  const brandNames = Object.fromEntries(BRAND_NAME_KEYS.map((k) => [k, 0])) as Record<BrandNameKey, number>
  const styles = Object.fromEntries(WORDMARK_STYLE_GROUPS.map((k) => [k, 0])) as Record<WordmarkStyleGroup, number>
  let rectangularStyle = 0
  for (const item of items) {
    if (isRectangularStyleCatalogItem(item)) rectangularStyle += 1
    const nk = previewBrandNameKeyForItem(item)
    if (nk) brandNames[nk] += 1
    const sg = previewStyleGroupForItem(item)
    if (sg) styles[sg] += 1
  }
  return { brandNames, rectangularStyle, styles }
}

export function isBrandNameKey(v: string): v is BrandNameKey {
  return (BRAND_NAME_KEYS as readonly string[]).includes(v)
}

export { isWordmarkStyleGroup }
