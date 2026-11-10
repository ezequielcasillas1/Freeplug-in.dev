import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import type { MerchLayer } from './layers'
import { MERCH_LAYER_ROUND_ROBIN_ORDER } from './layers'

/** Featured sort: round-robin Everyday → Give → Mind, preserving each layer's featuredRank order. */
export function sortFeaturedLayerRoundRobin(items: CatalogFilterItem[]): CatalogFilterItem[] {
  const buckets: Record<MerchLayer, CatalogFilterItem[]> = { everyday: [], give: [], mind: [] }
  for (const item of items) {
    const layer = item.layer ?? 'everyday'
    buckets[layer].push(item)
  }
  for (const layer of MERCH_LAYER_ROUND_ROBIN_ORDER) {
    buckets[layer].sort((a, b) => a.featuredRank - b.featuredRank || a.sortName.localeCompare(b.sortName))
  }
  const out: CatalogFilterItem[] = []
  const idx: Record<MerchLayer, number> = { everyday: 0, give: 0, mind: 0 }
  let progress = true
  while (progress) {
    progress = false
    for (const layer of MERCH_LAYER_ROUND_ROBIN_ORDER) {
      const list = buckets[layer]
      const i = idx[layer]
      if (i < list.length) {
        out.push(list[i]!)
        idx[layer] = i + 1
        progress = true
      }
    }
  }
  return out
}
