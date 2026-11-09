import type { SupabaseClient } from '@supabase/supabase-js'

export type MerchShopOrderStatus =
  | 'pending_review'
  | 'paid_cancellable'
  | 'held_moderation'
  | 'queued_printify'
  | 'printify_created'
  | 'printify_sent'
  | 'cancelled'
  | 'refunded'
  | 'approved'
  | 'rejected'
  | 'failed'

export type ShopModerationResult = 'pass' | 'fail' | 'held'

export type MerchShopOrderRow = {
  id: string
  stripe_checkout_session_id: string
  stripe_payment_intent_id: string | null
  status: MerchShopOrderStatus
  items: unknown
  buyer_email: string | null
  failure_detail: string | null
  moderation_result: ShopModerationResult | null
  moderation_detail: unknown
  rights_accepted_at: string | null
  rights_accepted_locale: string | null
  cancel_until: string | null
  held_until: string | null
  approved_at: string | null
  approved_by: string | null
  printify_order_id: string | null
  paid_at: string | null
  chicago_day_key: string | null
  created_at: string
  updated_at: string
}

export type MerchShopOrdersDb = {
  from(table: 'merch_shop_orders'): {
    select(cols: string): {
      eq(col: string, val: string): {
        maybeSingle(): Promise<{ data: MerchShopOrderRow | null; error: { message: string } | null }>
        single(): Promise<{ data: MerchShopOrderRow; error: { message: string } | null }>
      }
      in(col: string, vals: string[]): {
        select(cols: string): Promise<{ data: MerchShopOrderRow[]; error: { message: string } | null }>
      }
      gte(col: string, val: string): {
        lt(col: string, val: string): {
          eq(col: string, val: string): Promise<{ count: number | null; error: { message: string } | null }>
        }
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

export async function countCustomOrdersPaidChicagoDay(
  admin: SupabaseClient,
  dayStartIso: string,
  dayEndIso: string
): Promise<number> {
  const { count, error } = await admin
    .from('merch_shop_orders')
    .select('id', { count: 'exact', head: true })
    .gte('paid_at', dayStartIso)
    .lt('paid_at', dayEndIso)
    .filter('items->>design_mode', 'eq', 'custom')
  if (error) {
    console.error('[merch/shop-orders] count custom', error.message)
    return 0
  }
  return count ?? 0
}

export async function insertMerchShopOrderRow(
  db: MerchShopOrdersDb,
  row: Record<string, unknown>
): Promise<{ ok: true } | { error: 'duplicate' | 'insert_failed' }> {
  const { error } = await db.from('merch_shop_orders').insert(row)
  if (!error) return { ok: true }
  if (error.code === '23505') return { error: 'duplicate' }
  console.error('[merch/shop-orders] insert', error.message)
  return { error: 'insert_failed' }
}

export async function updateMerchShopOrderBySession(
  db: MerchShopOrdersDb,
  sessionId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await db
    .from('merch_shop_orders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('stripe_checkout_session_id', sessionId)
  if (error) console.error('[merch/shop-orders] update', error.message)
}

export async function markMerchShopOrderFailed(
  db: MerchShopOrdersDb,
  sessionId: string,
  detail: string
): Promise<void> {
  await updateMerchShopOrderBySession(db, sessionId, { status: 'failed', failure_detail: detail })
}
