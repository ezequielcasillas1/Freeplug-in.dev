import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getStripeFetch } from '@/lib/stripe/server'
import { isMerchFontBundleSession } from './checkout'
import { ensureMerchFontBundleToken, loadMerchTokenRow, revealMerchDownload, trySendMerchDownloadEmailOnce } from './delivery'
import { revokeMerchTokensByChargeId, revokeMerchTokensByPaymentIntent } from './tokens'
import { handleMerchCollectionCheckoutSessionCompleted } from './collections/fulfillment'
import { handleMerchShirtCheckoutSessionCompleted } from './shirts/fulfillment'
import { handleMerchShopCheckoutSessionCompleted } from './shop/fulfillment'

export async function handleMerchCheckoutSessionCompleted(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<'handled' | 'skipped'> {
  const shirt = await handleMerchShirtCheckoutSessionCompleted(admin, session)
  if (shirt === 'handled') return 'handled'
  const collection = await handleMerchCollectionCheckoutSessionCompleted(admin, session)
  if (collection === 'handled') return 'handled'
  const shop = await handleMerchShopCheckoutSessionCompleted(admin, session)
  if (shop === 'handled') return 'handled'
  if (!isMerchFontBundleSession(session)) return 'skipped'
  if (session.payment_status !== 'paid') {
    console.warn('[merch/webhook] checkout completed but not paid', session.id, session.payment_status)
    return 'handled'
  }
  const pi = session.payment_intent
  const paymentIntentId = typeof pi === 'string' ? pi : pi?.id ?? null
  const email = session.customer_details?.email ?? session.customer_email ?? null
  const ensured = await ensureMerchFontBundleToken(admin, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    buyerEmail: email,
  })
  if ('error' in ensured) {
    console.error('[merch/webhook] issue token', ensured.error)
    throw new Error(ensured.error)
  }
  if (email) {
    const row = await loadMerchTokenRow(admin, session.id)
    const reveal = row ? revealMerchDownload(row) : null
    if (reveal?.state === 'ready') {
      await trySendMerchDownloadEmailOnce(admin, session.id, email, reveal.token, reveal.expiresAt)
    }
  }
  return 'handled'
}

export async function handleMerchChargeRefunded(
  admin: SupabaseClient,
  charge: Stripe.Charge
): Promise<void> {
  if (!charge.payment_intent) return
  await revokeMerchTokensByChargeId(admin, getStripeFetch(), charge)
}

export async function handleMerchDisputeCreated(
  admin: SupabaseClient,
  dispute: Stripe.Dispute
): Promise<void> {
  const pi = dispute.payment_intent
  const piId = typeof pi === 'string' ? pi : pi?.id
  if (!piId) return
  await revokeMerchTokensByPaymentIntent(admin, piId)
}
