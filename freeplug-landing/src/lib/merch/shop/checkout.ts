import type Stripe from 'stripe'
import { appBaseUrl } from '@/lib/stripe/config'
import { stripeLocaleParam } from '@/lib/stripe/locale'
import type { AppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { formatUsdFromCents } from './pricing'
import { shopShippingCents, type ShopCheckoutLine } from './catalog'
import { getShopItem } from './catalog'

export const MERCH_SHOP_CHECKOUT_TYPE = 'merch_shop'
export const MERCH_SHOP_CURRENCY = 'usd'

export function merchShopCheckoutUrls(locale: AppLocale, slug: string) {
  const base = appBaseUrl()
  const productPath = `/shop/${slug}`
  return {
    success: `${base}${publicHref(`${productPath}/success`, locale)}?session_id={CHECKOUT_SESSION_ID}`,
    cancel: `${base}${publicHref(productPath, locale)}?checkout=cancelled`,
  }
}

export function buildMerchShopSessionParams(
  locale: AppLocale,
  line: ShopCheckoutLine
): Stripe.Checkout.SessionCreateParams {
  const item = getShopItem(line.slug)
  if (!item) throw new Error('shop_item_missing')
  const urls = merchShopCheckoutUrls(locale, line.slug)
  const shippingCents = shopShippingCents(item, line.quantity, line.unitAmountCents)
  const shippingLabel =
    shippingCents === 0
      ? 'Free US shipping (order over $50)'
      : line.quantity === 1
        ? `US shipping (${formatUsdFromCents(shippingCents)})`
        : `US shipping — ${line.quantity} items (${formatUsdFromCents(shippingCents)})`

  const description =
    line.designMode === 'custom'
      ? `${line.optionLabel} — custom artwork`
      : line.buyerWordmarkBrand && line.buyerWordmarkStyle
        ? `${line.optionLabel} — ${line.buyerWordmarkStyle} / ${line.buyerWordmarkBrand}`
        : `${line.optionLabel} — Freeplug wordmark`

  return {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: MERCH_SHOP_CURRENCY,
          unit_amount: line.unitAmountCents,
          product_data: {
            name: line.title,
            description,
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
          fixed_amount: { amount: shippingCents, currency: MERCH_SHOP_CURRENCY },
          display_name: shippingLabel,
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 2 },
            maximum: { unit: 'business_day', value: 10 },
          },
        },
      },
    ],
    metadata: {
      checkout_type: MERCH_SHOP_CHECKOUT_TYPE,
      merch_shop_slug: line.slug,
      merch_variant_id: String(line.variantId),
      merch_quantity: String(line.quantity),
      merch_design_mode: line.designMode,
      printify_product_id: line.printifyProductId ?? '',
      printify_variant_id: String(line.printifyVariantId),
      custom_upload_path: line.customUploadPath ?? '',
      custom_placement: line.customPlacement ? JSON.stringify(line.customPlacement) : '',
      shop_moderation_result: line.moderationResult ?? '',
      shop_moderation_detail: '',
      rights_accepted_at: line.designMode === 'custom' ? new Date().toISOString() : '',
      rights_accepted_locale: line.rightsAcceptedLocale ?? '',
      buyer_wordmark_brand: line.buyerWordmarkBrand ?? '',
      buyer_wordmark_style: line.buyerWordmarkStyle ?? '',
    },
    payment_intent_data: {
      metadata: {
        checkout_type: MERCH_SHOP_CHECKOUT_TYPE,
        merch_shop_slug: line.slug,
      },
    },
    ...stripeLocaleParam(locale),
  } as Stripe.Checkout.SessionCreateParams
}

export function isMerchShopSession(session: Stripe.Checkout.Session): boolean {
  return session.metadata?.checkout_type === MERCH_SHOP_CHECKOUT_TYPE
}
