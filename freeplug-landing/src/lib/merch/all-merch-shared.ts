/** Client-safe pieces of /merch/all (no catalog JSON imports). */
import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { SHOP_TABS, type ShopTabSlug } from '@/lib/merch/shop/types'

/** One card on /merch/all: merch-store products (t-shirts + collections) and every /shop item. */
export type AllMerchItem = CatalogFilterItem & {
  /** Translated client-side when set (merch-store titles live in messages); else `title` is used. */
  titleKey: string | null
  /** @deprecated Use comingSoonLabel */
  comingSoon: boolean
}

export const ALL_MERCH_CATEGORIES: readonly ShopTabSlug[] = SHOP_TABS

export function countAllMerchByCategory(items: AllMerchItem[]): Record<ShopTabSlug, number> {
  const counts = Object.fromEntries(ALL_MERCH_CATEGORIES.map((c) => [c, 0])) as Record<ShopTabSlug, number>
  for (const item of items) counts[item.category] += 1
  return counts
}
