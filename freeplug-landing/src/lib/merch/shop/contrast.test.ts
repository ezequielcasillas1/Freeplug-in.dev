import { describe, expect, it } from 'vitest'
import { classifyBlankColor, logoPathForBlank } from './contrast'

describe('shop logo contrast', () => {
  it('uses dark-garment file (light ink) on dark blanks', () => {
    expect(classifyBlankColor('Black')).toBe('dark')
    expect(logoPathForBlank('dark')).toBe('/merch/shop/freeplug-logo-dark-garment.png')
  })

  it('uses light-garment file (dark ink) on light blanks', () => {
    expect(classifyBlankColor('Ash')).toBe('light')
    expect(logoPathForBlank('light')).toBe('/merch/shop/freeplug-logo-light-garment.png')
  })
})
