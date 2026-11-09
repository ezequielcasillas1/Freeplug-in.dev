import type { SupabaseClient } from '@supabase/supabase-js'
import type { ValidatedCollectionLine } from './catalog'

export type MerchCollectionOrderRow = {
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

export type MerchCollectionOrdersDb = SupabaseClient & {
  from(table: 'merch_collection_orders'): {
    select(cols?: string): {
      eq(col: string, val: string): {
        maybeSingle(): Promise<{ data: MerchCollectionOrderRow | null; error: { message: string; code?: string } | null }>
      }
    }
    insert(row: Record<string, unknown>): {
      select(cols?: string): {
        single(): Promise<{ data: MerchCollectionOrderRow | null; error: { message: string; code?: string } | null }>
      }
    }
    update(patch: Record<string, unknown>): {
      eq(col: string, val: string): Promise<{ error: { message: string } | null }>
    }
  }
}

export type CollectionOrderItemSnapshot = {
  collection: string
  slug: string
  title: string
  option_key: string
  quantity: number
  printify_product_id: string
  printify_variant_id: number
}

export async function findMerchCollectionOrderBySession(
  admin: MerchCollectionOrdersDb,
  sessionId: string
): Promise<MerchCollectionOrderRow | null> {
  const { data, error } = await admin
    .from('merch_collection_orders')
    .select('*')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function insertMerchCollectionOrderPending(
  admin: MerchCollectionOrdersDb,
  opts: {
    stripeCheckoutSessionId: string
    buyerEmail: string | null
    line: ValidatedCollectionLine
  }
): Promise<{ row: MerchCollectionOrderRow } | { error: 'duplicate' }> {
  const items: CollectionOrderItemSnapshot[] = [
    {
      collection: opts.line.collection,
      slug: opts.line.slug,
      title: opts.line.title,
      option_key: opts.line.optionKey,
      quantity: opts.line.quantity,
      printify_product_id: opts.line.printifyProductId,
      printify_variant_id: opts.line.printifyVariantId,
    },
  ]
  const { data, error } = await admin
    .from('merch_collection_orders')
    .insert({
      stripe_checkout_session_id: opts.stripeCheckoutSessionId,
      printify_order_id: null,
      status: 'pending_printify',
      items,
      buyer_email: opts.buyerEmail,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'duplicate' }
    throw new Error(error.message)
  }
  if (!data) throw new Error('insert_failed')
  return { row: data }
}

export async function markMerchCollectionOrderFulfilled(
  admin: MerchCollectionOrdersDb,
  sessionId: string,
  printifyOrderId: string
): Promise<void> {
  const { error } = await admin
    .from('merch_collection_orders')
    .update({
      printify_order_id: printifyOrderId,
      status: 'printify_created',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_checkout_session_id', sessionId)
  if (error) throw new Error(error.message)
}

export async function markMerchCollectionOrderFailed(
  admin: MerchCollectionOrdersDb,
  sessionId: string,
  detail: string
): Promise<void> {
  const { error } = await admin
    .from('merch_collection_orders')
    .update({
      status: 'printify_failed',
      failure_detail: detail.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_checkout_session_id', sessionId)
  if (error) console.error('[merch/collection-orders] mark failed', error.message)
}
