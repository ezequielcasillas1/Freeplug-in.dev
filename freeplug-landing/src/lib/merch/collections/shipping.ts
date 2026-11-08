/** Flat US shipping estimates by product class (cents). Excludes tax; added at Stripe Checkout. */
export type MerchShippingClass =
  | 'mug'
  | 'drinkware_heavy'
  | 'hat'
  | 'apparel'
  | 'home_standard'
  | 'home_canvas_sm'
  | 'home_canvas_lg'
  | 'home_doormat'
  | 'sticker'

export const MERCH_SHIPPING_TABLE: Record<
  MerchShippingClass,
  { first_cents: number; additional_cents: number }
> = {
  mug: { first_cents: 599, additional_cents: 250 },
  drinkware_heavy: { first_cents: 899, additional_cents: 350 },
  hat: { first_cents: 699, additional_cents: 300 },
  apparel: { first_cents: 495, additional_cents: 240 },
  home_standard: { first_cents: 799, additional_cents: 400 },
  home_canvas_sm: { first_cents: 1299, additional_cents: 600 },
  home_canvas_lg: { first_cents: 1999, additional_cents: 800 },
  home_doormat: { first_cents: 1499, additional_cents: 700 },
  sticker: { first_cents: 399, additional_cents: 75 },
}

export function merchShippingCents(shippingClass: MerchShippingClass, quantity: number): number {
  if (quantity < 1) return 0
  const row = MERCH_SHIPPING_TABLE[shippingClass]
  return row.first_cents + row.additional_cents * (quantity - 1)
}
