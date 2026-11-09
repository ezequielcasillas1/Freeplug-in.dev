import { buildMerchLayerAssignmentTable } from './layer-map'
import type { MerchLayer } from './layers'
import { MERCH_LAYERS } from './layers'
import { listAllMerchItems } from '@/lib/merch/all-merch'

export type CoreMerchSlot =
  | 'tee'
  | 'hoodie'
  | 'hat'
  | 'mug-tumbler'
  | 'sticker'
  | 'home-decor'

export const CORE_MERCH_SLOTS: readonly CoreMerchSlot[] = [
  'tee',
  'hoodie',
  'hat',
  'mug-tumbler',
  'sticker',
  'home-decor',
]

function slotForKey(key: string, productType: string | null, category: string): CoreMerchSlot | null {
  const k = key.toLowerCase()
  const pt = (productType ?? '').toLowerCase()
  if (pt === 't-shirt' || k.startsWith('tshirts/') || pt.includes('tee') || k.includes('-tee')) {
    if (k.includes('hoodie')) return 'hoodie'
    return 'tee'
  }
  if (pt === 'hoodie' || k.includes('hoodie') || k.includes('pullover') || k.includes('crewneck') || k.includes('sweatshirt')) {
    return 'hoodie'
  }
  if (pt === 'hat' || category === 'hats' || k.includes('hat') || k.includes('beanie') || k.includes('cap')) return 'hat'
  if (
    category === 'drinkware' ||
    pt === 'mug' ||
    k.includes('mug') ||
    k.includes('tumbler') ||
    k.includes('bottle')
  ) {
    return 'mug-tumbler'
  }
  if (pt === 'sticker' || k.includes('sticker')) return 'sticker'
  if (
    category === 'home' ||
    category === 'wall-art' ||
    k.includes('poster') ||
    k.includes('canvas') ||
    k.includes('pillow') ||
    k.includes('blanket') ||
    k.includes('framed')
  ) {
    return 'home-decor'
  }
  return null
}

export type CoreSetLayerReport = Record<
  MerchLayer,
  { present: CoreMerchSlot[]; missing: CoreMerchSlot[] }
>

export function computeCoreSetByLayer(): CoreSetLayerReport {
  const items = listAllMerchItems()
  const assignments = buildMerchLayerAssignmentTable()
  const layerByKey = new Map(assignments.map((a) => [a.key, a.layer]))

  const present: Record<MerchLayer, Set<CoreMerchSlot>> = {
    everyday: new Set(),
    give: new Set(),
    mind: new Set(),
  }

  for (const item of items) {
    const layer = layerByKey.get(item.key) ?? 'everyday'
    const slot = slotForKey(item.key, item.productType, item.category)
    if (slot) present[layer].add(slot)
  }

  const report = {} as CoreSetLayerReport
  for (const layer of MERCH_LAYERS) {
    const have = [...present[layer]].sort()
    const missing = CORE_MERCH_SLOTS.filter((s) => !present[layer].has(s))
    report[layer] = { present: have, missing: [...missing] }
  }
  return report
}

export function formatCoreSetTableMarkdown(report: CoreSetLayerReport): string {
  const header = '| Layer | Tee | Hoodie | Hat | Mug/tumbler | Sticker | Home decor |'
  const sep = '| --- | --- | --- | --- | --- | --- | --- |'
  const rows = MERCH_LAYERS.map((layer) => {
    const cells = CORE_MERCH_SLOTS.map((slot) => (report[layer].present.includes(slot) ? '✓' : '—'))
    return `| ${layer} | ${cells.join(' | ')} |`
  })
  return [header, sep, ...rows].join('\n')
}
