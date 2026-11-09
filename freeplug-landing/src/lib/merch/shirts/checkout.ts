import type Stripe from 'stripe'
import { appBaseUrl } from '@/lib/stripe/config'
import { stripeLocaleParam } from '@/lib/stripe/locale'
import type { AppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import {
  MERCH_SHIRT_CHECKOUT_TYPE,
  SHIRT_CURRENCY,
  formatUsdFromCents,
  shirtShippingCents,
  type ValidatedShirtLine,
} from './catalog'

export function merchShirtCheckoutUrls(locale: AppLocale, slug: string) {
  const base = appBaseUrl()
  const productPath = `/merch/t-shirts/${slug}`
  return {
    success: `${base}${publicHref(`${productPath}/success`, locale)}?session_id={CHECKOUT_SESSION_ID}`,
    cancel: `${base}${publicHref(productPath, locale)}?checkout=cancelled`,
  }
}

export function buildMerchShirtSessionParams(
  locale: AppLocale,
  line: ValidatedShirtLine,
  shippingCents: number
): Stripe.Checkout.SessionCreateParams {
  const urls = merchShirtCheckoutUrls(locale, line.slug)
  const shippingLabel =
    line.quantity === 1
      ? `US shipping (${formatUsdFromCents(shippingCents)})`
      : `US shipping — ${line.quantity} shirts (${formatUsdFromCents(shippingCents)})`

  return {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: SHIRT_CURRENCY,
          unit_amount: line.unitAmountCents,
          product_data: {
            name: line.title,
            description: `${line.color} · ${line.size}`,
          },
        },
        quantity: line.quantity,
      },
    ],
    success_url: urls.success,
    cancel_url: urls.cancel,
    automatic_tax: { enabled: false },
    customer_creation: 'always',
    shipping_address_collection: { allowed_countries: ['US'] },
    phone_number_collection: { enabled: false },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: shippingCents, currency: SHIRT_CURRENCY },
          display_name: shippingLabel,
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 2 },
            maximum: { unit: 'business_day', value: 7 },
          },
        },
      },
    ],
    metadata: {
      checkout_type: MERCH_SHIRT_CHECKOUT_TYPE,
      product_slug: line.slug,
      shirt_color: line.color,
      shirt_size: line.size,
      shirt_quantity: String(line.quantity),
      printify_product_id: line.printifyProductId,
      printify_variant_id: String(line.printifyVariantId),
    },
    payment_intent_data: {
      metadata: {
        checkout_type: MERCH_SHIRT_CHECKOUT_TYPE,
        product_slug: line.slug,
      },
    },
    ...stripeLocaleParam(locale),
  } as Stripe.Checkout.SessionCreateParams
}

export function isMerchShirtSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.checkout_type === MERCH_SHIRT_CHECKOUT_TYPE
}
