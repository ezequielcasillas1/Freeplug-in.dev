import { describe, expect, it } from 'vitest'
import {
  getShirtBySlug,
  listPublicShirtProducts,
  shirtPriceCents,
  validateShirtCheckoutLine,
  SHIRT_MIN_FROM_PRICE_CENTS,
  SHIRT_SHIPPING_ADDITIONAL_CENTS,
  SHIRT_SHIPPING_FIRST_CENTS,
  shirtShippingCents,
} from './catalog'

describe('merch shirt catalog pricing', () => {
  const frontOnly = getShirtBySlug('03-get-plugged-in')!
  const frontBack = getShirtBySlug('01-know-a-plug')!

  it('front-only S–XL is $15.99', () => {
    expect(shirtPriceCents(frontOnly, 'M')).toBe(1599)
  })

  it('front-only 2XL is $17.99', () => {
    expect(shirtPriceCents(frontOnly, '2XL')).toBe(1799)
  })

  it('front-only 3XL is $19.99', () => {
    expect(shirtPriceCents(frontOnly, '3XL')).toBe(1999)
  })

  it('front+back S–XL is $21.99 (Cheke Nov 8)', () => {
    expect(shirtPriceCents(frontBack, 'L')).toBe(2199)
    expect(shirtPriceCents(getShirtBySlug('02-circle-mark')!, 'S')).toBe(2199)
  })

  it('front+back 2XL is $23.99', () => {
    expect(shirtPriceCents(frontBack, '2XL')).toBe(2399)
  })

  it('front+back 3XL is $25.99', () => {
    expect(shirtPriceCents(frontBack, '3XL')).toBe(2599)
  })

  it('listing From price uses cheapest front-only tier', () => {
    expect(SHIRT_MIN_FROM_PRICE_CENTS).toBe(1599)
    const listed = listPublicShirtProducts()
    expect(listed.find((p) => p.slug === '03-get-plugged-in')?.fromPriceCents).toBe(1599)
    expect(listed.find((p) => p.slug === '01-know-a-plug')?.fromPriceCents).toBe(2199)
  })

  it('rejects client price tampering (server derives amount)', () => {
    const v = validateShirtCheckoutLine({
      slug: '01-know-a-plug',
      color: 'Black',
      size: 'XL',
      quantity: 1,
    })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.line.unitAmountCents).toBe(2199)
  })

  it('shipping is $4.95 + $2.40 per extra shirt', () => {
    expect(SHIRT_SHIPPING_FIRST_CENTS).toBe(495)
    expect(SHIRT_SHIPPING_ADDITIONAL_CENTS).toBe(240)
    expect(shirtShippingCents(1)).toBe(495)
    expect(shirtShippingCents(3)).toBe(495 + 240 * 2)
  })
})
