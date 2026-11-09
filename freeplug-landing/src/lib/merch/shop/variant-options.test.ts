import { describe, expect, it } from 'vitest'
import { pickerMode, resolveVariant, sizesForColor } from './variant-options'
import type { ShopVariant } from './types'

const sample: ShopVariant[] = [
  {
    id: 1,
    title: 'S / Black',
    color: 'Black',
    size: 'S',
    costCents: 1000,
    retailCents: 1999,
    blankKind: 'dark',
    logoFile: '/merch/shop/freeplug-logo-light-garment.png',
    printArea: { place: 'front', width: 3000, height: 3000, position: { x: 0.5, y: 0.42, scale: 0.38 } },
  },
  {
    id: 2,
    title: 'M / White',
    color: 'White',
    size: 'M',
    costCents: 1000,
    retailCents: 1999,
    blankKind: 'light',
    logoFile: '/merch/shop/freeplug-logo-dark-garment.png',
    printArea: { place: 'front', width: 3000, height: 3000, position: { x: 0.5, y: 0.42, scale: 0.38 } },
  },
]

describe('shop variant options', () => {
  it('uses color-size mode when both exist', () => {
    expect(pickerMode(sample)).toBe('color-size')
  })

  it('resolves by color and size', () => {
    const v = resolveVariant(sample, { color: 'White', size: 'M', variantId: null })
    expect(v?.id).toBe(2)
  })

  it('lists sizes for a color', () => {
    expect(sizesForColor(sample, 'Black')).toEqual(['S'])
  })
})
