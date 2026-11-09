import type { MerchLayer } from './layers'
import { MERCH_LAYER_BALANCE_WARN_THRESHOLD, MERCH_LAYERS } from './layers'
import { buildMerchLayerAssignmentTable, countMerchByLayer } from './layer-map'

export type MerchLayerBalanceReport = {
  total: number
  counts: Record<MerchLayer, number>
  shares: Record<MerchLayer, number>
  warnings: string[]
}

export function computeMerchLayerBalance(): MerchLayerBalanceReport {
  const assignments = buildMerchLayerAssignmentTable()
  const counts = countMerchByLayer(assignments)
  const total = assignments.length
  const shares = Object.fromEntries(MERCH_LAYERS.map((l) => [l, total ? counts[l] / total : 0])) as Record<
    MerchLayer,
    number
  >
  const warnings: string[] = []
  for (const layer of MERCH_LAYERS) {
    if (shares[layer] > MERCH_LAYER_BALANCE_WARN_THRESHOLD) {
      warnings.push(
        `WARN: layer "${layer}" is ${(shares[layer] * 100).toFixed(1)}% of live designs (>${MERCH_LAYER_BALANCE_WARN_THRESHOLD * 100}% threshold).`
      )
    }
  }
  return { total, counts, shares, warnings }
}

export function formatMerchLayerBalanceLines(report: MerchLayerBalanceReport): string[] {
  const lines = [
    `Merch layer balance (${report.total} live designs)`,
    ...MERCH_LAYERS.map((l) => `  ${l}: ${report.counts[l]} (${(report.shares[l] * 100).toFixed(1)}%)`),
    ...report.warnings,
  ]
  return lines
}
