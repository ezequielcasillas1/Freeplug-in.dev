import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isMerchShopSession } from './checkout'
import { chicagoDayBoundsUtc } from './daily-cap'
import { autosendEnabledForOrder, cancelUntilIso, heldUntilIso, initialShopOrderStatus } from './state-machine'
import {
  findMerchShopOrderBySession,
  insertMerchShopOrderRow,
  type MerchShopOrdersDb,
  type ShopModerationResult,
} from './orders'

function moderationFromSession(session: Stripe.Checkout.Session): ShopModerationResult | null {
  const raw = session.metadata?.shop_moderation_result
  if (raw === 'pass' || raw === 'fail' || raw === 'held') return raw
  return null
}

export async function handleMerchShopCheckoutSessionCompleted(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<'handled' | 'skipped'> {
  if (!isMerchShopSession(session)) return 'skipped'
  if (session.payment_status !== 'paid') {
    console.warn('[merch/shop-webhook] checkout completed but not paid', session.id, session.payment_status)
    return 'handled'
  }

  const db = admin as unknown as MerchShopOrdersDb
  const existing = await findMerchShopOrderBySession(db, session.id)
  if (existing) return 'handled'

  const email = session.customer_details?.email ?? session.customer_email ?? null
  const designMode = session.metadata?.merch_design_mode === 'custom' ? 'custom' : 'freeplug'
  const moderation = designMode === 'custom' ? moderationFromSession(session) : null
  const autosend = designMode === 'custom' && autosendEnabledForOrder()
  const paidAt = new Date()
  const { dayKey } = chicagoDayBoundsUtc(paidAt)

  const items = {
    slug: session.metadata?.merch_shop_slug,
    variant_id: session.metadata?.merch_variant_id,
    quantity: session.metadata?.merch_quantity,
    design_mode: designMode,
    custom_upload_path: session.metadata?.custom_upload_path || null,
    custom_placement: session.metadata?.custom_placement ? JSON.parse(session.metadata.custom_placement) : null,
    printify_product_id: session.metadata?.printify_product_id || null,
    printify_variant_id: session.metadata?.printify_variant_id || null,
  }

  const rightsAcceptedAt = session.metadata?.rights_accepted_at || null
  const rightsLocale = session.metadata?.rights_accepted_locale || null

  const status = initialShopOrderStatus({ designMode, moderation, autosend })

  await insertMerchShopOrderRow(db, {
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
    status,
    items,
    buyer_email: email,
    moderation_result: moderation,
    moderation_detail: session.metadata?.shop_moderation_detail
      ? JSON.parse(session.metadata.shop_moderation_detail)
      : null,
    rights_accepted_at: rightsAcceptedAt,
    rights_accepted_locale: rightsLocale,
    paid_at: paidAt.toISOString(),
    chicago_day_key: dayKey,
    cancel_until: status === 'paid_cancellable' ? cancelUntilIso(paidAt) : null,
    held_until: status === 'held_moderation' ? heldUntilIso(paidAt) : null,
  })

  return 'handled'
}
