/** Flat US shipping estimates by product class (cents). Excludes tax; added at Stripe Checkout. */
export type MerchShippingClass =
  | 'mug_11_12'
  | 'mug_15'
  | 'drinkware_tall'
  | 'hat'
  | 'crewneck'
  | 'candle_keychain'
  | 'desk_mat'
  | 'journal'
  | 'pillow'
  | 'canvas_sm'
  | 'canvas_lg'
  | 'doormat'
  | 'sticker'
  | 'apparel_light'
  | 'home_standard'
  | 'drinkware_heavy'
  | 'pet_bed'
  | 'serving_tray'

export const MERCH_SHIPPING_TABLE: Record<
  MerchShippingClass,
  { first_cents: number; additional_cents: number }
> = {
  mug_11_12: { first_cents: 749, additional_cents: 349 },
  mug_15: { first_cents: 949, additional_cents: 399 },
  drinkware_tall: { first_cents: 749, additional_cents: 399 },
  hat: { first_cents: 699, additional_cents: 300 },
  crewneck: { first_cents: 899, additional_cents: 249 },
  candle_keychain: { first_cents: 849, additional_cents: 349 },
  desk_mat: { first_cents: 1099, additional_cents: 749 },
  journal: { first_cents: 799, additional_cents: 400 },
  pillow: { first_cents: 1249, additional_cents: 1199 },
  canvas_sm: { first_cents: 1399, additional_cents: 449 },
  canvas_lg: { first_cents: 1999, additional_cents: 800 },
  doormat: { first_cents: 2149, additional_cents: 2049 },
  sticker: { first_cents: 549, additional_cents: 75 },
  apparel_light: { first_cents: 495, additional_cents: 240 },
  home_standard: { first_cents: 799, additional_cents: 400 },
  drinkware_heavy: { first_cents: 749, additional_cents: 399 },
  pet_bed: { first_cents: 2749, additional_cents: 2499 },
  serving_tray: { first_cents: 2399, additional_cents: 499 },
}

/** Merch subtotal above this (cents) gets $0 shipping. Exactly $50.00 does not qualify. */
export const MERCH_COLLECTION_FREE_SHIPPING_THRESHOLD_CENTS = 5000

export function merchShippingCents(shippingClass: MerchShippingClass, quantity: number): number {
  if (quantity < 1) return 0
  const row = MERCH_SHIPPING_TABLE[shippingClass]
  return row.first_cents + row.additional_cents * (quantity - 1)
}

export function collectionMerchandiseShippingCents(
  shippingClass: MerchShippingClass,
  quantity: number,
  unitAmountCents: number
): number {
  const merchandiseSubtotalCents = unitAmountCents * quantity
  if (merchandiseSubtotalCents > MERCH_COLLECTION_FREE_SHIPPING_THRESHOLD_CENTS) return 0
  return merchShippingCents(shippingClass, quantity)
}

export function qualifiesForFreeCollectionShipping(merchandiseSubtotalCents: number): boolean {
  return merchandiseSubtotalCents > MERCH_COLLECTION_FREE_SHIPPING_THRESHOLD_CENTS
}
