import type { SupabaseClient } from '@supabase/supabase-js'

export type MerchShopOrderStatus = 'pending_review' | 'approved' | 'rejected' | 'failed'

export type MerchShopOrderRow = {
  id: string
  stripe_checkout_session_id: string
  status: MerchShopOrderStatus
  items: unknown
  buyer_email: string | null
  failure_detail: string | null
  created_at: string
  updated_at: string
}

export type MerchShopOrdersDb = {
  from(table: 'merch_shop_orders'): {
    select(cols: string): {
      eq(col: string, val: string): {
        maybeSingle(): Promise<{ data: MerchShopOrderRow | null; error: { message: string } | null }>
      }
    }
    insert(row: Record<string, unknown>): Promise<{ error: { code?: string; message: string } | null }>
    update(row: Record<string, unknown>): {
      eq(col: string, val: string): Promise<{ error: { message: string } | null }>
    }
  }
}

export async function findMerchShopOrderBySession(
  db: MerchShopOrdersDb,
  sessionId: string
): Promise<MerchShopOrderRow | null> {
  const { data, error } = await db.from('merch_shop_orders').select('*').eq('stripe_checkout_session_id', sessionId).maybeSingle()
  if (error) {
    console.error('[merch/shop-orders] find', error.message)
    return null
  }
  return data
}

export async function insertMerchShopOrderPending(
  db: MerchShopOrdersDb,
  row: {
    stripeCheckoutSessionId: string
    buyerEmail: string | null
    items: unknown
  }
): Promise<{ ok: true } | { error: 'duplicate' | 'insert_failed' }> {
  const { error } = await db.from('merch_shop_orders').insert({
    stripe_checkout_session_id: row.stripeCheckoutSessionId,
    status: 'pending_review',
    items: row.items,
    buyer_email: row.buyerEmail,
  })
  if (!error) return { ok: true }
  if (error.code === '23505') return { error: 'duplicate' }
  console.error('[merch/shop-orders] insert', error.message)
  return { error: 'insert_failed' }
}

export async function markMerchShopOrderFailed(
  db: MerchShopOrdersDb,
  sessionId: string,
  detail: string
): Promise<void> {
  const { error } = await db
    .from('merch_shop_orders')
    .update({ status: 'failed', failure_detail: detail, updated_at: new Date().toISOString() })
    .eq('stripe_checkout_session_id', sessionId)
  if (error) console.error('[merch/shop-orders] mark failed', error.message)
}
