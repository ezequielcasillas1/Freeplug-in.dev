import { describe, expect, it } from 'vitest'
import {
  getCatalogProduct,
  listCatalogProducts,
  validateCollectionCheckoutLine,
  crewneckUnitPriceCents,
} from './catalog'

describe('merch collections catalog', () => {
  it('lists 79 catalog products (22 wave-1 + 57 wave-3)', () => {
    expect(listCatalogProducts()).toHaveLength(79)
  })

  it('wave-3 pin uses approved $3.99 retail', () => {
    const pin = getCatalogProduct('pin-fp-mark')!
    expect(pin.options[0]?.price_cents).toBe(399)
  })

  it('wave-3 stay-charged pullover uses approved $64.99', () => {
    const h = getCatalogProduct('stay-charged-pullover')!
    expect(h.options[0]?.price_cents).toBe(6499)
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

})
