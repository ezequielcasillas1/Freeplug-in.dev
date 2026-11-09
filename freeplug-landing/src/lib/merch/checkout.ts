import type Stripe from 'stripe'
import { appBaseUrl } from '@/lib/stripe/config'
import { stripeLocaleParam } from '@/lib/stripe/locale'
import type { AppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import {
  FONT_BUNDLE_CURRENCY,
  FONT_BUNDLE_PRICE_CENTS,
  MERCH_CHECKOUT_TYPE,
  MERCH_FONT_BUNDLE_SLUG,
} from './product'

export function merchCheckoutUrls(locale: AppLocale) {
  const base = appBaseUrl()
  const productPath = `/merch/${MERCH_FONT_BUNDLE_SLUG}`
  return {
    success: `${base}${publicHref(`${productPath}/success`, locale)}?session_id={CHECKOUT_SESSION_ID}`,
    cancel: `${base}${publicHref(productPath, locale)}?checkout=cancelled`,
  }
}

export function buildMerchFontBundleSessionParams(locale: AppLocale, priceId?: string | null): Stripe.Checkout.SessionCreateParams {
  const urls = merchCheckoutUrls(locale)
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          price_data: {
            currency: FONT_BUNDLE_CURRENCY,
            unit_amount: FONT_BUNDLE_PRICE_CENTS,
            product_data: {
              name: 'Freeplug Font Bundle',
              description:
                '12 styles: FP Extended (6), Freeplug Dispatch (3), FP Cursive v2 (3). Personal & client use.',
            },
          },
          quantity: 1,
        },
      ]

  return {
    mode: 'payment',
    line_items: lineItems,
    success_url: urls.success,
    cancel_url: urls.cancel,
    // TODO: Stripe Tax — pending owner decision (leave automatic tax off for now).
    automatic_tax: { enabled: false },
    // Checkout Sessions use dynamic payment methods from the Stripe Dashboard (cards, Apple Pay,
    // Google Pay, Cash App Pay where enabled). Do NOT send automatic_payment_methods: Stripe rejects it here.
    customer_creation: 'always',
    metadata: {
      checkout_type: MERCH_CHECKOUT_TYPE,
      product_slug: MERCH_FONT_BUNDLE_SLUG,
    },
    payment_intent_data: {
      metadata: {
        checkout_type: MERCH_CHECKOUT_TYPE,
        product_slug: MERCH_FONT_BUNDLE_SLUG,
      },
    },
    ...stripeLocaleParam(locale),
  } as Stripe.Checkout.SessionCreateParams
}

export function isMerchFontBundleSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.checkout_type === MERCH_CHECKOUT_TYPE
}
