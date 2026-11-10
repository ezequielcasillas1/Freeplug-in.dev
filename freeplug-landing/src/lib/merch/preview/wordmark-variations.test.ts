import { describe, expect, it } from 'vitest'
import { BRAND_NAME_KEYS } from './brand-names'
import { WORDMARK_VARIATIONS } from './wordmark-variations'

describe('wordmark variation catalog', () => {
  it('defines 26 treatments with 3–5 per brand name', () => {
    expect(WORDMARK_VARIATIONS.length).toBeGreaterThanOrEqual(20)
    expect(WORDMARK_VARIATIONS.length).toBeLessThanOrEqual(30)
    const counts = Object.fromEntries(BRAND_NAME_KEYS.map((k) => [k, 0])) as Record<string, number>
    for (const v of WORDMARK_VARIATIONS) counts[v.nameKey]! += 1
    for (const key of BRAND_NAME_KEYS) {
      expect(counts[key]).toBeGreaterThanOrEqual(3)
      expect(counts[key]).toBeLessThanOrEqual(6)
    }
  })
})
