import type { CatalogSource } from '@/lib/merch/catalog-filter-types'

/** Buyer-shop uses blank mockups + site SVG wordmarks (not baked Printify listing art). */
export function buyerShopUsesPreviewWordmarkOverlay(source: CatalogSource | null): boolean {
  return source === 'buyer-shop'
}

/**
 * Legacy merch-store plain-garment overlays (unchanged on main / PR #62).
 * Buyer-shop overlays are handled separately in resolvePreviewWordmark.
 */
export function isPlainCatalogGarment(source: CatalogSource | null): boolean {
  void source
  return false
}

/** Catalog filter “rectangular style” previews — not designed init/world tee chest art (see resolvePreviewWordmark). */
export function catalogShirtSkipsPreviewWordmarkOverlay(source: CatalogSource | null): boolean {
  return source === 't-shirts'
}
