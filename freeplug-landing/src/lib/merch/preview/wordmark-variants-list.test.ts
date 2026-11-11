import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  listPlainGarmentsWordmarkVariants,
  summarizeWordmarkVariantsList,
  wordmarkVariantsListToCsv,
} from './wordmark-variants-list'

describe('wordmark variants list', () => {
  it('lists 195 buyer-shop + 79 merch-store plain garments', () => {
    const rows = listPlainGarmentsWordmarkVariants()
    const summary = summarizeWordmarkVariantsList(rows)
    expect(summary.total).toBe(274)
    expect(summary.buyerShop).toBe(195)
    expect(summary.merchStore).toBe(79)
    expect(summary.bakedInPrintify).toBeGreaterThan(0)
    expect(summary.swappableAtFulfillment).toBe(summary.total - summary.bakedInPrintify)
  })

  it('marks merch-store and accent mug as baked', () => {
    const rows = listPlainGarmentsWordmarkVariants()
    const accent = rows.find((r) => r.slug === '11oz-accent-mug-583')
    expect(accent?.wordmarkBakedInPrintify).toBe(true)
    const mug = rows.find((r) => r.slug === 'fully-charged-mug')
    expect(mug?.catalogSource).toBe('merch-store')
    expect(mug?.wordmarkBakedInPrintify).toBe(true)
  })

  it('matches committed CSV when regenerated', () => {
    const csvPath = join(process.cwd(), 'docs/merch/wordmark-variants-list.csv')
    const onDisk = readFileSync(csvPath, 'utf8')
    const rows = listPlainGarmentsWordmarkVariants()
    expect(wordmarkVariantsListToCsv(rows)).toBe(onDisk)
  })
})
