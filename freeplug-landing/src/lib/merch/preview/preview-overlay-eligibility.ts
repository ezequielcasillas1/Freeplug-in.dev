import type { CatalogSource } from '@/lib/merch/catalog-filter-types'

/**
 * Preview wordmark overlays apply only to plain shop/collection garments without
 * their own front design art. The t-shirts catalog is exclusively designed tees.
 */
export function isPlainCatalogGarment(source: CatalogSource | null): boolean {
  return source === 'buyer-shop' || source === 'merch-store'
}

export function catalogShirtSkipsPreviewWordmarkOverlay(source: CatalogSource | null): boolean {
  return source === 't-shirts'
}
