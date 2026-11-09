import type { SupabaseClient } from '@supabase/supabase-js'
import type { ValidatedShirtLine } from './catalog'

export type MerchShirtOrderRow = {
  id: string
  stripe_checkout_session_id: string
  printify_order_id: string | null
  status: string
  items: unknown
  buyer_email: string | null
  failure_detail: string | null
  created_at: string
  updated_at: string
}

export type MerchShirtOrdersDb = SupabaseClient & {
  from(table: 'merch_shirt_orders'): {
    select(cols?: string): {
      eq(col: string, val: string): { maybeSingle(): Promise<{ data: MerchShirtOrderRow | null; error: { message: string; code?: string } | null }> }
    }
    insert(row: Record<string, unknown>): { select(cols?: string): { single(): Promise<{ data: MerchShirtOrderRow | null; error: { message: string; code?: string } | null }> } }
    update(patch: Record<string, unknown>): {
      eq(col: string, val: string): Promise<{ error: { message: string } | null }>
    }
  }
}

export type ShirtOrderItemSnapshot = {
  slug: string
  title: string
  color: string
  size: string
  quantity: number
  printify_product_id: string
  printify_variant_id: number
}

export async function findMerchShirtOrderBySession(
  admin: MerchShirtOrdersDb,
  sessionId: string
): Promise<MerchShirtOrderRow | null> {
  const { data, error } = await admin.from('merch_shirt_orders').select('*').eq('stripe_checkout_session_id', sessionId).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function insertMerchShirtOrderPending(
  admin: MerchShirtOrdersDb,
  opts: {
    stripeCheckoutSessionId: string
    buyerEmail: string | null
    line: ValidatedShirtLine
  }
): Promise<{ row: MerchShirtOrderRow } | { error: 'duplicate' }> {
  const items: ShirtOrderItemSnapshot[] = [
    {
      slug: opts.line.slug,
      title: opts.line.title,
      color: opts.line.color,
      size: opts.line.size,
      quantity: opts.line.quantity,
      printify_product_id: opts.line.printifyProductId,
      printify_variant_id: opts.line.printifyVariantId,
    },
  ]
  const { data, error } = await admin.from('merch_shirt_orders').insert({
    stripe_checkout_session_id: opts.stripeCheckoutSessionId,
    printify_order_id: null,
    status: 'pending_printify',
    items,
    buyer_email: opts.buyerEmail,
  }).select('*').single()

  if (error) {
    if (error.code === '23505') return { error: 'duplicate' }
    throw new Error(error.message)
  }
  if (!data) throw new Error('insert_failed')
  return { row: data }
}

export async function markMerchShirtOrderFulfilled(
  admin: MerchShirtOrdersDb,
  sessionId: string,
  printifyOrderId: string
): Promise<void> {
  const { error } = await admin.from('merch_shirt_orders').update({
    printify_order_id: printifyOrderId,
    status: 'printify_created',
    updated_at: new Date().toISOString(),
  }).eq('stripe_checkout_session_id', sessionId)
  if (error) throw new Error(error.message)
}

export async function markMerchShirtOrderFailed(admin: MerchShirtOrdersDb, sessionId: string, detail: string): Promise<void> {
  const { error } = await admin.from('merch_shirt_orders').update({
    status: 'printify_failed',
    failure_detail: detail.slice(0, 2000),
    updated_at: new Date().toISOString(),
  }).eq('stripe_checkout_session_id', sessionId)
  if (error) console.error('[merch/shirt-orders] mark failed', error.message)
}
