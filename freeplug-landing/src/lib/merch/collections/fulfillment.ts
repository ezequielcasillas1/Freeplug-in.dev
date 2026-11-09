import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ownerAlertRecipient } from '@/lib/owner-alerts/send'
import { sendMail } from '@/lib/email/mailer'
import {
  createPrintifyOrder,
  printifyConfigured,
  printifyShopId,
  sendPrintifyOrderToProduction,
  shouldAutoSendPrintifyToProduction,
  stripeShippingToPrintifyAddress,
  type PrintifyDeps,
} from '../shirts/printify'
import { getCatalogProduct } from './catalog'
import { isMerchCollectionSession } from './checkout'
import {
  findMerchCollectionOrderBySession,
  insertMerchCollectionOrderPending,
  markMerchCollectionOrderFailed,
  markMerchCollectionOrderFulfilled,
  type MerchCollectionOrdersDb,
} from './orders'
import { sendMerchCollectionOrderEmail } from '../email'

function lineFromSessionMetadata(session: Stripe.Checkout.Session) {
  const collection = session.metadata?.merch_collection
  const slug = session.metadata?.product_slug
  const optionKey = session.metadata?.merch_option_key
  const qty = session.metadata?.merch_quantity
  const productId = session.metadata?.printify_product_id
  const variantId = session.metadata?.printify_variant_id
  if (!collection || !slug || !optionKey || !productId || !variantId || !qty) return null
  const entry = getCatalogProduct(slug)
  if (!entry || entry.collection !== collection) return null
  const quantity = parseInt(qty, 10)
  const printifyVariantId = parseInt(variantId, 10)
  if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(printifyVariantId)) return null
  return {
    collection,
    slug,
    title: entry.title,
    optionKey,
    quantity,
    printifyProductId: productId,
    printifyVariantId,
  }
}

export type CollectionFulfillmentDeps = {
  fetch?: typeof fetch
}

export async function handleMerchCollectionCheckoutSessionCompleted(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
  deps: CollectionFulfillmentDeps = {}
): Promise<'handled' | 'skipped'> {
  if (!isMerchCollectionSession(session)) return 'skipped'
  if (session.payment_status !== 'paid') {
    console.warn('[merch/collection-webhook] checkout completed but not paid', session.id, session.payment_status)
    return 'handled'
  }

  const line = lineFromSessionMetadata(session)
  if (!line) {
    console.error('[merch/collection-webhook] missing metadata', session.id)
    throw new Error('collection_metadata_invalid')
  }

  const db = admin as unknown as MerchCollectionOrdersDb
  const existing = await findMerchCollectionOrderBySession(db, session.id)
  if (existing?.printify_order_id) return 'handled'
  if (existing && existing.status === 'printify_created') return 'handled'

  const email = session.customer_details?.email ?? session.customer_email ?? null

  if (!existing) {
    const option = getCatalogProduct(line.slug)?.options.find((o) => o.key === line.optionKey)
    const ins = await insertMerchCollectionOrderPending(db, {
      stripeCheckoutSessionId: session.id,
      buyerEmail: email,
      line: {
        collection: line.collection as import('./catalog').MerchCollectionSlug,
        slug: line.slug,
        title: line.title,
        optionKey: line.optionKey,
        optionLabel: line.optionKey,
        quantity: line.quantity,
        unitAmountCents: option?.price_cents ?? 0,
        shippingClass:
          option?.shipping_class ?? getCatalogProduct(line.slug)?.shipping_class ?? 'journal',
        printifyProductId: line.printifyProductId,
        printifyVariantId: line.printifyVariantId,
      },
    })
    if ('error' in ins && ins.error === 'duplicate') {
      const again = await findMerchCollectionOrderBySession(db, session.id)
      if (again?.printify_order_id) return 'handled'
    }
  }

  if (!printifyConfigured()) {
    console.error('[merch/collection-webhook] PRINTIFY_API_TOKEN not set', session.id)
    await markMerchCollectionOrderFailed(db, session.id, 'printify_not_configured')
    void alertOwnerPrintifyFailure(session.id, email, 'Printify not configured (PRINTIFY_API_TOKEN missing)')
    throw new Error('printify_not_configured')
  }

  const address = stripeShippingToPrintifyAddress(session)
  if (!address) {
    await markMerchCollectionOrderFailed(db, session.id, 'missing_shipping_address')
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
    console.error('[merch/collection-webhook] printify create failed', session.id, created.error)
    await markMerchCollectionOrderFailed(db, session.id, created.error)
    void alertOwnerPrintifyFailure(session.id, address.email, created.error)
    throw new Error('printify_create_failed')
  }

  await markMerchCollectionOrderFulfilled(db, session.id, created.orderId)

  if (shouldAutoSendPrintifyToProduction()) {
    const sent = await sendPrintifyOrderToProduction(created.orderId, printifyDeps)
    if (!sent.ok) {
      console.error('[merch/collection-webhook] send_to_production failed', created.orderId, sent.error)
    }
  }

  if (email) {
    try {
      await sendMerchCollectionOrderEmail({
        to: email,
        title: line.title,
        optionLabel: line.optionKey,
        quantity: line.quantity,
      })
    } catch (e) {
      console.error('[merch/collection-webhook] email', e instanceof Error ? e.message : e)
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
      subject: `Merch collection Printify failure (${sessionId})`,
      text: `Stripe session: ${sessionId}\nBuyer: ${buyerEmail ?? 'unknown'}\n\n${detail}`,
      replyTo: null,
      idempotencyKey: `merch-collection-alert:${sessionId}`.slice(0, 256),
      template: 'owner-alert',
    })
  } catch (e) {
    console.error('[merch/collection-webhook] owner alert', e instanceof Error ? e.message : e)
  }
}
