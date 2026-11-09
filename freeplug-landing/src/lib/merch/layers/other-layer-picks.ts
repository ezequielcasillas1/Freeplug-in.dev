import { listAllMerchItems } from '@/lib/merch/all-merch'
import type { AllMerchItem } from '@/lib/merch/all-merch-shared'
import { merchLayerForKey } from './layer-map'
import type { MerchLayer } from './layers'
import { MERCH_LAYER_ROUND_ROBIN_ORDER } from './layers'

function isBuyable(item: AllMerchItem): boolean {
  return item.availability.includes('buyable')
}

/** ~4 items from the two layers that are not `currentLayer`, buyable-first. */
export function pickOtherLayerMerchItems(currentKey: string, currentLayer: MerchLayer, limit = 4): AllMerchItem[] {
  const otherLayers = MERCH_LAYER_ROUND_ROBIN_ORDER.filter((l) => l !== currentLayer)
  const all = listAllMerchItems().filter((i) => i.key !== currentKey)

  const picked: AllMerchItem[] = []
  const perLayerTarget = Math.ceil(limit / otherLayers.length)

  for (const layer of otherLayers) {
    const pool = all
      .filter((i) => merchLayerForKey(i.key) === layer)
      .sort((a, b) => {
        const ab = isBuyable(a) ? 0 : 1
        const bb = isBuyable(b) ? 0 : 1
        if (ab !== bb) return ab - bb
        return a.featuredRank - b.featuredRank
      })
    for (const item of pool) {
      if (picked.length >= limit) break
      if (picked.some((p) => p.key === item.key)) continue
      if (picked.filter((p) => merchLayerForKey(p.key) === layer).length >= perLayerTarget) continue
      picked.push(item)
    }
  }

  if (picked.length < limit) {
    for (const layer of otherLayers) {
      for (const item of all.filter((i) => merchLayerForKey(i.key) === layer)) {
        if (picked.length >= limit) break
        if (!picked.some((p) => p.key === item.key)) picked.push(item)
      }
    }
  }

  return picked.slice(0, limit)
}
