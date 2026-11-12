import { describe, expect, it } from 'vitest'
import { BUYER_WORDMARK_VARIANT_COUNT, listBuyerWordmarkVariants } from './buyer-wordmark-variants'

describe('buyer wordmark variants', () => {
  it('exposes 16 style × name combinations', () => {
    expect(BUYER_WORDMARK_VARIANT_COUNT).toBe(16)
    const all = listBuyerWordmarkVariants()
    expect(all).toHaveLength(16)
    const ids = new Set(all.map((v) => v.variationId))
    expect(ids.size).toBe(16)
  })
})
