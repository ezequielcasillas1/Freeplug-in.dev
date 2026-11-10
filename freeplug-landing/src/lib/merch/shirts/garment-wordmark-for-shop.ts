import { stableCatalogIndex, variationIdForStableIndex } from '@/lib/merch/preview/wordmark-variations'
import { getSupremeVariationId } from './supreme-preview'

/** Picks a stable preview variation for /shop garment logo overlays (not print files). */
export function garmentWordmarkForShopSlug(slug: string): string {
  const mapped = getSupremeVariationId(slug)
  if (mapped) return mapped
  return variationIdForStableIndex(stableCatalogIndex(`shop/${slug}`))
}
