import { getStripeFetch } from '@/lib/stripe/server'

export async function refundMerchShopPaymentIntent(
  paymentIntentId: string,
  reason: string
): Promise<{ ok: true; refundId: string } | { ok: false; error: string }> {
  if (!paymentIntentId.trim()) return { ok: false, error: 'missing_payment_intent' }
  try {
    const stripe = getStripeFetch()
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      metadata: { merch_shop_refund_reason: reason.slice(0, 200) },
    })
    return { ok: true, refundId: refund.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
