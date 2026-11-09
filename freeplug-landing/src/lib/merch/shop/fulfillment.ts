import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isMerchShopSession } from './checkout'
import { findMerchShopOrderBySession, insertMerchShopOrderPending, type MerchShopOrdersDb } from './orders'

/**
 * Shop orders are held for owner review. No Printify API calls (preview / draft phase).
 */
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
  const items = {
    slug: session.metadata?.merch_shop_slug,
    variant_id: session.metadata?.merch_variant_id,
    quantity: session.metadata?.merch_quantity,
    design_mode: session.metadata?.merch_design_mode,
    custom_upload_path: session.metadata?.custom_upload_path || null,
    custom_placement: session.metadata?.custom_placement || null,
    printify_product_id: session.metadata?.printify_product_id || null,
    printify_variant_id: session.metadata?.printify_variant_id || null,
  }

  await insertMerchShopOrderPending(db, {
    stripeCheckoutSessionId: session.id,
    buyerEmail: email,
    items,
  })

  return 'handled'
}
