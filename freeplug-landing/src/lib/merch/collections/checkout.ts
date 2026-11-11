import type Stripe from 'stripe'
import { appBaseUrl } from '@/lib/stripe/config'
import { stripeLocaleParam } from '@/lib/stripe/locale'
import type { AppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import {
  MERCH_COLLECTION_CHECKOUT_TYPE,
  MERCH_CURRENCY,
  collectionLineShippingCents,
  formatUsdFromCents,
  type ValidatedCollectionLine,
} from './catalog'

export function merchCollectionCheckoutUrls(locale: AppLocale, collection: string, slug: string) {
  const base = appBaseUrl()
  const productPath = `/merch/${collection}/${slug}`
  return {
    success: `${base}${publicHref(`${productPath}/success`, locale)}?session_id={CHECKOUT_SESSION_ID}`,
    cancel: `${base}${publicHref(productPath, locale)}?checkout=cancelled`,
  }
}

export function buildMerchCollectionSessionParams(
  locale: AppLocale,
  line: ValidatedCollectionLine
): Stripe.Checkout.SessionCreateParams {
  const urls = merchCollectionCheckoutUrls(locale, line.collection, line.slug)
  const shippingCents = collectionLineShippingCents(line)
  const shippingLabel =
    shippingCents === 0
      ? 'Free US shipping (order over $50)'
      : line.quantity === 1
        ? `US shipping (${formatUsdFromCents(shippingCents)})`
        : `US shipping — ${line.quantity} items (${formatUsdFromCents(shippingCents)})`

  return {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: MERCH_CURRENCY,
          unit_amount: line.unitAmountCents,
          product_data: {
            name: line.title,
            description: line.optionLabel,
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
          fixed_amount: { amount: shippingCents, currency: MERCH_CURRENCY },
          display_name: shippingLabel,
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 2 },
            maximum: { unit: 'business_day', value: 10 },
          },
        },
      },
    ],
    metadata: {
      checkout_type: MERCH_COLLECTION_CHECKOUT_TYPE,
      merch_collection: line.collection,
      product_slug: line.slug,
      merch_option_key: line.optionKey,
      merch_quantity: String(line.quantity),
      printify_product_id: line.printifyProductId,
      printify_variant_id: String(line.printifyVariantId),
      merch_wordmark_brand: line.buyerWordmarkBrand,
    },
    payment_intent_data: {
      metadata: {
        checkout_type: MERCH_COLLECTION_CHECKOUT_TYPE,
        product_slug: line.slug,
      },
    },
    ...stripeLocaleParam(locale),
  } as Stripe.Checkout.SessionCreateParams
}

export function isMerchCollectionSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.checkout_type === MERCH_COLLECTION_CHECKOUT_TYPE
}
