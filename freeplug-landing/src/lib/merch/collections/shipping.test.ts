import { describe, expect, it } from 'vitest'
import { getCatalogProduct } from './catalog'
import { collectionLineShippingCents, validateCollectionCheckoutLine } from './catalog'
import {
  MERCH_COLLECTION_FREE_SHIPPING_THRESHOLD_CENTS,
  collectionMerchandiseShippingCents,
  merchShippingCents,
  qualifiesForFreeCollectionShipping,
} from './shipping'

describe('merch collection shipping', () => {
  it('wave-3 classes cover Printify estimates', () => {
    expect(merchShippingCents('apparel_light', 1)).toBe(495)
    expect(merchShippingCents('home_standard', 1)).toBe(799)
    expect(merchShippingCents('drinkware_heavy', 1)).toBe(749)
    expect(merchShippingCents('pet_bed', 1)).toBe(2749)
    expect(merchShippingCents('serving_tray', 1)).toBe(2399)
  })

  it('recharge-pet-bed maps to pet_bed class', () => {
    const bed = getCatalogProduct('recharge-pet-bed')!
    const line = validateCollectionCheckoutLine({
      collection: 'pets',
      slug: 'recharge-pet-bed',
      option_key: bed.options[0]!.key,
      quantity: 1,
    })
    expect(line.ok).toBe(true)
    if (line.ok) expect(line.line.shippingClass).toBe('pet_bed')
  })
  it('mug_11_12 and mug_15 per-option classes', () => {
    expect(merchShippingCents('mug_11_12', 1)).toBe(749)
    expect(merchShippingCents('mug_11_12', 2)).toBe(749 + 349)
    expect(merchShippingCents('mug_15', 1)).toBe(949)

    const mug = getCatalogProduct('fully-charged-mug')!
    const v11 = validateCollectionCheckoutLine({
      collection: 'drinkware',
      slug: 'fully-charged-mug',
      option_key: '11oz',
      quantity: 1,
    })
    const v15 = validateCollectionCheckoutLine({
      collection: 'drinkware',
      slug: 'fully-charged-mug',
      option_key: '15oz',
      quantity: 1,
    })
    expect(v11.ok && v11.line.shippingClass).toBe('mug_11_12')
    expect(v15.ok && v15.line.shippingClass).toBe('mug_15')
    if (v11.ok) expect(collectionLineShippingCents(v11.line)).toBe(749)
    if (v15.ok) expect(collectionLineShippingCents(v15.line)).toBe(949)
    expect(mug.options.find((o) => o.key === '24x36')).toBeUndefined()
  })

  it('canvas 24x36 uses canvas_lg not sm', () => {
    const v = validateCollectionCheckoutLine({
      collection: 'home-faith',
      slug: 'running-over-canvas',
      option_key: '24x36',
      quantity: 1,
    })
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.line.shippingClass).toBe('canvas_lg')
      expect(merchShippingCents('canvas_lg', 1)).toBe(1999)
      expect(collectionLineShippingCents(v.line)).toBe(0)
    }
    const v16 = validateCollectionCheckoutLine({
      collection: 'home-faith',
      slug: 'running-over-canvas',
      option_key: '16x20',
      quantity: 1,
    })
    if (v16.ok) {
      expect(v16.line.shippingClass).toBe('canvas_sm')
      expect(merchShippingCents('canvas_sm', 1)).toBe(1399)
      expect(collectionLineShippingCents(v16.line)).toBe(1399)
    }
  })

  it('free shipping when subtotal is strictly over $50', () => {
    expect(MERCH_COLLECTION_FREE_SHIPPING_THRESHOLD_CENTS).toBe(5000)
    expect(qualifiesForFreeCollectionShipping(5000)).toBe(false)
    expect(qualifiesForFreeCollectionShipping(5001)).toBe(true)

    expect(collectionMerchandiseShippingCents('sticker', 10, 501)).toBe(0)

    const at50 = validateCollectionCheckoutLine({
      collection: 'apparel',
      slug: 'hero-crewneck',
      size: 'M',
      color: 'Black',
      quantity: 1,
    })
    expect(at50.ok).toBe(true)
    if (at50.ok) {
      expect(at50.line.unitAmountCents).toBe(4899)
      expect(collectionLineShippingCents(at50.line)).toBe(899)
    }

    const twoMugs = validateCollectionCheckoutLine({
      collection: 'drinkware',
      slug: 'day-one-tumbler',
      option_key: '20oz',
      quantity: 2,
    })
    if (twoMugs.ok) {
      expect(twoMugs.line.unitAmountCents * 2).toBe(8998)
      expect(collectionLineShippingCents(twoMugs.line)).toBe(0)
    }
  })
})
