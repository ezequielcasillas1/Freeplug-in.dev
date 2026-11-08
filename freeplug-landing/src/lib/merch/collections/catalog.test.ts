import { describe, expect, it } from 'vitest'
import {
  getCatalogProduct,
  listCatalogProducts,
  validateCollectionCheckoutLine,
  crewneckUnitPriceCents,
} from './catalog'
import { merchShippingCents } from './shipping'

describe('merch collections catalog', () => {
  it('lists 22 products', () => {
    expect(listCatalogProducts()).toHaveLength(22)
  })

  it('fully charged mug prices match approved retail', () => {
    const mug = getCatalogProduct('fully-charged-mug')!
    expect(mug.options.find((o) => o.key === '11oz')?.price_cents).toBe(899)
    expect(mug.options.find((o) => o.key === '15oz')?.price_cents).toBe(1199)
  })

  it('hero crewneck 2XL is $53.99', () => {
    expect(crewneckUnitPriceCents('2XL')).toBe(5399)
  })

  it('validates crewneck line server-side', () => {
    const v = validateCollectionCheckoutLine({
      collection: 'apparel',
      slug: 'hero-crewneck',
      size: 'M',
      color: 'Sand',
      quantity: 1,
    })
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.line.unitAmountCents).toBe(4899)
      expect(v.line.printifyVariantId).toBe(25425)
    }
  })

  it('mug shipping uses flat table', () => {
    expect(merchShippingCents('mug', 1)).toBe(599)
    expect(merchShippingCents('mug', 2)).toBe(849)
  })
})
