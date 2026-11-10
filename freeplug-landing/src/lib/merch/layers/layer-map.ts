import { listAllMerchItems } from '@/lib/merch/all-merch'
import type { MerchLayer } from './layers'
import { attachMerchLayer } from './attach-layer'

export function merchLayerForKey(key: string): MerchLayer {
  return attachMerchLayer(key)
}

export type MerchLayerAssignment = { key: string; layer: MerchLayer; href: string; sortName: string }

export function buildMerchLayerAssignmentTable(): MerchLayerAssignment[] {
  return listAllMerchItems()
    .map((item) => ({
      key: item.key,
      layer: merchLayerForKey(item.key),
      href: item.href,
      sortName: item.sortName,
    }))
    .sort((a, b) => a.layer.localeCompare(b.layer) || a.key.localeCompare(b.key))
}

export function countMerchByLayer(assignments = buildMerchLayerAssignmentTable()): Record<MerchLayer, number> {
  const counts: Record<MerchLayer, number> = { everyday: 0, give: 0, mind: 0 }
  for (const row of assignments) counts[row.layer] += 1
  return counts
}
