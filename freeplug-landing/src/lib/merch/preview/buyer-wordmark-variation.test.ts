import { describe, expect, it } from 'vitest'
import { getWordmarkVariation } from './wordmark-variations'
import { variationIdForBuyerWordmark } from './buyer-wordmark-variation'

describe('buyer wordmark variation registry', () => {
  it('registers all 16 buyer brand × style combinations', () => {
    const id = variationIdForBuyerWordmark('freeplug-dev', 'cursive')
    const def = getWordmarkVariation(id)
    expect(def?.treatment).toBe('buyer-raster')
    expect(def?.nameKey).toBe('freeplug-dev')
  })
})
