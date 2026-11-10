#!/usr/bin/env node
import { computeMerchLayerBalance, formatMerchLayerBalanceLines } from '../src/lib/merch/layers/layer-balance.ts'
import { computeCoreSetByLayer, formatCoreSetTableMarkdown } from '../src/lib/merch/layers/layer-core-set.ts'
import { buildMerchLayerAssignmentTable } from '../src/lib/merch/layers/layer-map.ts'

const balance = computeMerchLayerBalance()
for (const line of formatMerchLayerBalanceLines(balance)) console.log(line)

console.log('')
console.log('Core set by layer:')
console.log(formatCoreSetTableMarkdown(computeCoreSetByLayer()))

console.log('')
console.log(`Full assignments (${buildMerchLayerAssignmentTable().length} rows):`)
for (const row of buildMerchLayerAssignmentTable()) {
  console.log(`${row.layer}\t${row.key}`)
}

if (balance.warnings.length) process.exitCode = 0
