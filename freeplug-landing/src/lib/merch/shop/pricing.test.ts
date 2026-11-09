import { describe, expect, it } from 'vitest'
import { retailCentsFromCostCents } from './pricing'

describe('shop pricing', () => {
  it('rounds to next .99 from cost / 0.55', () => {
    expect(retailCentsFromCostCents(1234)).toBe(2299)
    expect(retailCentsFromCostCents(232)).toBe(499)
  })
})
