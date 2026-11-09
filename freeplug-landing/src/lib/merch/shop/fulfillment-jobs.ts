import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMail } from '@/lib/email/mailer'
import {
  createPrintifyOrder,
  printifyConfigured,
  printifyShopId,
  sendPrintifyOrderToProduction,
  stripeShippingToPrintifyAddress,
  type PrintifyDeps,
} from '../shirts/printify'
import { getShopItem, resolveShopVariant } from './catalog'
import { createPrintifyCustomProduct, uploadPrintifyImage } from './printify-custom'
import { shouldAutoRefundHeld, shouldQueuePrintify } from './state-machine'
import {
  findMerchShopOrderBySession,
  type MerchShopOrderRow,
  type MerchShopOrdersDb,
  updateMerchShopOrderBySession,
} from './orders'
import { refundMerchShopPaymentIntent } from './stripe-refund'
import { MERCH_SHOP_UPLOAD_BUCKET } from '../server'
import type Stripe from 'stripe'

export type ShopFulfillmentJobDeps = {
  fetch?: typeof fetch
  now?: () => Date
  loadSession?: (sessionId: string) => Promise<Stripe.Checkout.Session | null>
  downloadUpload?: (path: string) => Promise<Uint8Array | null>
}

function itemsFromRow(row: MerchShopOrderRow) {
  const items = row.items as {
    slug?: string
    variant_id?: number
    quantity?: number
    design_mode?: string
    custom_upload_path?: string | null
    custom_placement?: { x: number; y: number; scale: number } | null
    printify_product_id?: string | null
    printify_variant_id?: number
  }
  return items
}

async function downloadDefaultUpload(admin: SupabaseClient, storagePath: string): Promise<Uint8Array | null> {
  const objectPath = storagePath.replace(`${MERCH_SHOP_UPLOAD_BUCKET}/`, '')
  const { data, error } = await admin.storage.from(MERCH_SHOP_UPLOAD_BUCKET).download(objectPath)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

export async function processShopOrderAutosend(
  admin: SupabaseClient,
  row: MerchShopOrderRow,
  deps: ShopFulfillmentJobDeps = {}
): Promise<void> {
  const db = admin as unknown as MerchShopOrdersDb
  const now = deps.now?.() ?? new Date()
  const items = itemsFromRow(row)
  const sessionId = row.stripe_checkout_session_id

  if (shouldAutoRefundHeld(row.status, row.held_until, now)) {
    if (row.stripe_payment_intent_id) {
      const refunded = await refundMerchShopPaymentIntent(row.stripe_payment_intent_id, 'held_moderation_timeout')
      await updateMerchShopOrderBySession(db, sessionId, {
        status: refunded.ok ? 'refunded' : 'failed',
        failure_detail: refunded.ok ? 'held_auto_refund_48h' : refunded.error,
      })
      if (refunded.ok && row.buyer_email) {
        await sendHeldRefundEmail(row.buyer_email, sessionId)
      }
    }
    return
  }

  if (!shouldQueuePrintify(row.status, row.cancel_until, now)) return
  if (items.design_mode !== 'custom') return

  await updateMerchShopOrderBySession(db, sessionId, { status: 'queued_printify' })

  if (!printifyConfigured()) {
    await updateMerchShopOrderBySession(db, sessionId, { status: 'failed', failure_detail: 'printify_not_configured' })
    return
  }

  const slug = items.slug ?? ''
  const item = getShopItem(slug)
  const variantId = items.printify_variant_id ?? items.variant_id ?? 0
  const variant = item ? resolveShopVariant(item, variantId) : null
  if (!item || !variant) {
    await updateMerchShopOrderBySession(db, sessionId, { status: 'failed', failure_detail: 'catalog_line_invalid' })
    return
  }

  const uploadPath = items.custom_upload_path ?? ''
  const bytes = deps.downloadUpload
    ? await deps.downloadUpload(uploadPath)
    : await downloadDefaultUpload(admin, uploadPath)
  if (!bytes) {
    await updateMerchShopOrderBySession(db, sessionId, { status: 'failed', failure_detail: 'upload_missing' })
    return
  }

  const printifyDeps: PrintifyDeps = {
    fetch: deps.fetch ?? fetch,
    apiToken: process.env.PRINTIFY_API_TOKEN!.trim(),
    shopId: printifyShopId(),
  }

  const placement = items.custom_placement ?? variant.printArea.position
  const uploaded = await uploadPrintifyImage(bytes, 'custom.png', printifyDeps)
  if (!uploaded.ok) {
    await failWithRefund(db, row, uploaded.error)
    return
  }

  const product = await createPrintifyCustomProduct(item, variant, uploaded.imageId, placement, printifyDeps)
  if (!product.ok) {
    await failWithRefund(db, row, product.error)
    return
  }

  const loadSession = deps.loadSession
  if (!loadSession) {
    await updateMerchShopOrderBySession(db, sessionId, { status: 'failed', failure_detail: 'session_loader_missing' })
    return
  }
  const session = await loadSession(sessionId)
  if (!session) {
    await updateMerchShopOrderBySession(db, sessionId, { status: 'failed', failure_detail: 'stripe_session_missing' })
    return
  }

  const address = stripeShippingToPrintifyAddress(session)
  if (!address) {
    await failWithRefund(db, row, 'missing_shipping_address')
    return
  }

  const quantity = items.quantity ?? 1
  const created = await createPrintifyOrder(
    {
      external_id: sessionId,
      line_items: [{ product_id: product.productId, variant_id: variant.id, quantity }],
      shipping_method: 1,
      address_to: address,
      send_shipping_notification: true,
    },
    printifyDeps
  )

  if (!created.ok) {
    await failWithRefund(db, row, created.error)
    return
  }

  await updateMerchShopOrderBySession(db, sessionId, {
    status: 'printify_created',
    printify_order_id: created.orderId,
  })

  const sent = await sendPrintifyOrderToProduction(created.orderId, printifyDeps)
  if (sent.ok) {
    await updateMerchShopOrderBySession(db, sessionId, { status: 'printify_sent' })
  }
}

async function failWithRefund(db: MerchShopOrdersDb, row: MerchShopOrderRow, detail: string): Promise<void> {
  const sessionId = row.stripe_checkout_session_id
  if (row.stripe_payment_intent_id) {
    const refunded = await refundMerchShopPaymentIntent(row.stripe_payment_intent_id, `printify_reject:${detail}`)
    await updateMerchShopOrderBySession(db, sessionId, {
      status: refunded.ok ? 'refunded' : 'failed',
      failure_detail: detail,
    })
    if (refunded.ok && row.buyer_email) await sendPrintifyRejectEmail(row.buyer_email, sessionId, detail)
    return
  }
  await updateMerchShopOrderBySession(db, sessionId, { status: 'failed', failure_detail: detail })
}

async function sendHeldRefundEmail(to: string, sessionId: string): Promise<void> {
  try {
    await sendMail({
      to,
      subject: 'Custom merch order refunded (review timeout)',
      text: `Your custom shop order (${sessionId}) was refunded after 48 hours without approval.`,
      replyTo: null,
      idempotencyKey: `merch-shop-held-refund:${sessionId}`.slice(0, 256),
      template: 'owner-alert',
    })
  } catch (e) {
    console.error('[merch/shop-jobs] refund email', e instanceof Error ? e.message : e)
  }
}

async function sendPrintifyRejectEmail(to: string, sessionId: string, detail: string): Promise<void> {
  try {
    await sendMail({
      to,
      subject: 'Custom merch order refunded',
      text: `Your custom shop order (${sessionId}) could not be produced and was refunded.\n\n${detail}`,
      replyTo: null,
      idempotencyKey: `merch-shop-printify-refund:${sessionId}`.slice(0, 256),
      template: 'owner-alert',
    })
  } catch (e) {
    console.error('[merch/shop-jobs] printify refund email', e instanceof Error ? e.message : e)
  }
}

export async function approveHeldShopOrder(
  db: MerchShopOrdersDb,
  sessionId: string,
  approvedBy: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await findMerchShopOrderBySession(db, sessionId)
  if (!row) return { ok: false, error: 'not_found' }
  if (row.status !== 'held_moderation') return { ok: false, error: 'not_held' }
  const paidAt = row.paid_at ? new Date(row.paid_at) : new Date()
  const cancelUntil = new Date(paidAt.getTime() + 60 * 60 * 1000).toISOString()
  await updateMerchShopOrderBySession(db, sessionId, {
    status: 'paid_cancellable',
    approved_at: new Date().toISOString(),
    approved_by: approvedBy,
    cancel_until: cancelUntil,
    held_until: null,
  })
  return { ok: true }
}
