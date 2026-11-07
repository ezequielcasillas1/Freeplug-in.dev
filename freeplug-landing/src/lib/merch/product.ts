/** Merch catalog — Freeplug Font Bundle (test-mode checkout preview). */

export const MERCH_FONT_BUNDLE_SLUG = 'freeplug-font-bundle' as const

export const MERCH_CHECKOUT_TYPE = 'merch_font_bundle' as const

export const FONT_BUNDLE_PRICE_CENTS = 4999

export const FONT_BUNDLE_CURRENCY = 'usd' as const

/** Twelve styles across three families × light / regular / bold. */
export const FONT_BUNDLE_STYLES = [
  'FP Extended — Light, Regular, Bold',
  'Freeplug Dispatch — Light, Regular, Bold',
  'FP Cursive — Light, Regular, Bold (v2, matches the Fp logo)',
] as const

export const FONT_BUNDLE_USE_CASES = [
  'Script and cursive logo marks',
  'Bold display type for shirts and merch',
  'Extended width headlines and posters',
  'Client websites with @font-face / web embedding',
] as const

export function isMerchMockCheckoutEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MERCH_MOCK_CHECKOUT?.trim().toLowerCase() === 'true'
}

export function stripeConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim())
}

export const MERCH_PERSONAL_USE_SLUG = 'fonts-personal-use' as const
export const MERCH_TSHIRTS_SLUG = 't-shirts' as const
