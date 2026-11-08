import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ownerAlertRecipient } from '@/lib/owner-alerts/send'
import { sendMail } from '@/lib/email/mailer'
import { sendMerchShirtOrderEmail } from '../email'
import {
  createPrintifyOrder,
  printifyConfigured,
  printifyShopId,
  sendPrintifyOrderToProduction,
  shouldAutoSendPrintifyToProduction,
  stripeShippingToPrintifyAddress,
  type PrintifyDeps,
} from './printify'
import { getShirtBySlug } from './catalog'
import {
  findMerchShirtOrderBySession,
  insertMerchShirtOrderPending,
  markMerchShirtOrderFailed,
  markMerchShirtOrderFulfilled,
  type MerchShirtOrdersDb,
} from './orders'
import { isMerchShirtSession } from './checkout'

function lineFromSessionMetadata(session: Stripe.Checkout.Session) {
  const slug = session.metadata?.product_slug
  const color = session.metadata?.shirt_color
  const size = session.metadata?.shirt_size
  const qty = session.metadata?.shirt_quantity
  const productId = session.metadata?.printify_product_id
  const variantId = session.metadata?.printify_variant_id
  if (!slug || !color || !size || !productId || !variantId || !qty) return null
  const entry = getShirtBySlug(slug)
  if (!entry) return null
  const quantity = parseInt(qty, 10)
  const printifyVariantId = parseInt(variantId, 10)
  if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(printifyVariantId)) return null
  return {
    slug,
    title: entry.title,
    color,
    size,
    quantity,
    printifyProductId: productId,
    printifyVariantId,
    backPrint: entry.back_print,
    unitAmountCents: 0,
  }
}

export type ShirtFulfillmentDeps = {
  fetch?: typeof fetch
}

export async function handleMerchShirtCheckoutSessionCompleted(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
  deps: ShirtFulfillmentDeps = {}
): Promise<'handled' | 'skipped'> {
  if (!isMerchShirtSession(session)) return 'skipped'
  if (session.payment_status !== 'paid') {
    console.warn('[merch/shirt-webhook] checkout completed but not paid', session.id, session.payment_status)
    return 'handled'
  }

  const line = lineFromSessionMetadata(session)
  if (!line) {
    console.error('[merch/shirt-webhook] missing metadata', session.id)
    throw new Error('shirt_metadata_invalid')
  }

  const db = admin as unknown as MerchShirtOrdersDb
  const existing = await findMerchShirtOrderBySession(db, session.id)
  if (existing?.printify_order_id) return 'handled'
  if (existing && existing.status === 'printify_created') return 'handled'

  const email = session.customer_details?.email ?? session.customer_email ?? null

  if (!existing) {
    const ins = await insertMerchShirtOrderPending(db, {
      stripeCheckoutSessionId: session.id,
      buyerEmail: email,
      line: {
        ...line,
        color: line.color as import('./catalog').ShirtColor,
        size: line.size as import('./catalog').ShirtSize,
      },
    })
    if ('error' in ins && ins.error === 'duplicate') {
      const again = await findMerchShirtOrderBySession(db, session.id)
      if (again?.printify_order_id) return 'handled'
    }
  }

  if (!printifyConfigured()) {
    console.error('[merch/shirt-webhook] PRINTIFY_API_TOKEN not set', session.id)
    await markMerchShirtOrderFailed(db, session.id, 'printify_not_configured')
    void alertOwnerPrintifyFailure(session.id, email, 'Printify not configured (PRINTIFY_API_TOKEN missing)')
    throw new Error('printify_not_configured')
  }

  const address = stripeShippingToPrintifyAddress(session)
  if (!address) {
    await markMerchShirtOrderFailed(db, session.id, 'missing_shipping_address')
    throw new Error('missing_shipping_address')
  }

  const printifyDeps: PrintifyDeps = {
    fetch: deps.fetch ?? fetch,
    apiToken: process.env.PRINTIFY_API_TOKEN!.trim(),
    shopId: printifyShopId(),
  }

  const created = await createPrintifyOrder(
    {
      external_id: session.id,
      line_items: [{ product_id: line.printifyProductId, variant_id: line.printifyVariantId, quantity: line.quantity }],
      shipping_method: 1,
      address_to: address,
      send_shipping_notification: true,
    },
    printifyDeps
  )

  if (!created.ok) {
    console.error('[merch/shirt-webhook] printify create failed', session.id, created.error)
    await markMerchShirtOrderFailed(db, session.id, created.error)
    void alertOwnerPrintifyFailure(session.id, address.email, created.error)
    throw new Error('printify_create_failed')
  }

  await markMerchShirtOrderFulfilled(db, session.id, created.orderId)

  if (shouldAutoSendPrintifyToProduction()) {
    const sent = await sendPrintifyOrderToProduction(created.orderId, printifyDeps)
    if (!sent.ok) {
      console.error('[merch/shirt-webhook] send_to_production failed', created.orderId, sent.error)
    }
  }

  if (email) {
    try {
      await sendMerchShirtOrderEmail({
        to: email,
        title: line.title,
        color: line.color,
        size: line.size,
        quantity: line.quantity,
      })
    } catch (e) {
      console.error('[merch/shirt-webhook] email', e instanceof Error ? e.message : e)
    }
  }

  return 'handled'
}

async function alertOwnerPrintifyFailure(sessionId: string, buyerEmail: string | null, detail: string): Promise<void> {
  const to = ownerAlertRecipient()
  if (!to) return
  try {
    await sendMail({
      to,
      subject: `Merch shirt Printify failure (${sessionId})`,
      text: `Stripe session: ${sessionId}\nBuyer: ${buyerEmail ?? 'unknown'}\n\n${detail}`,
      replyTo: null,
      idempotencyKey: `merch-shirt-alert:${sessionId}`.slice(0, 256),
      template: 'owner-alert',
    })
  } catch (e) {
    console.error('[merch/shirt-webhook] owner alert', e instanceof Error ? e.message : e)
  }
}
