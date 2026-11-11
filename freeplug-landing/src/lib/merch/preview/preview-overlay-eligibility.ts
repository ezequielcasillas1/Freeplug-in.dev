import type { CatalogSource } from '@/lib/merch/catalog-filter-types'

/**
 * Preview wordmark overlays apply only to plain catalog garments without their own
 * front design art. Buyer-shop and merch-store items ship with product artwork;
 * the t-shirts catalog is exclusively designed tees — no source currently qualifies.
 */
export function isPlainCatalogGarment(source: CatalogSource | null): boolean {
  void source
  return false
}

export function catalogShirtSkipsPreviewWordmarkOverlay(source: CatalogSource | null): boolean {
  return source === 't-shirts'
}
