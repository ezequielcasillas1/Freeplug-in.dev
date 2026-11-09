import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripeFetch } from '@/lib/stripe/server'
import { processShopOrderAutosend } from '@/lib/merch/shop/fulfillment-jobs'
import type { MerchShopOrderRow } from '@/lib/merch/shop/orders'
export const runtime = 'nodejs'

function cronAuthorized(request: Request): boolean {
  const expected = process.env.MERCH_SHOP_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  if (!expected) return false
  const got = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  return got === expected
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = supabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { data, error } = await admin
    .from('merch_shop_orders')
    .select('*')
    .in('status', ['paid_cancellable', 'held_moderation'])
  if (error) {
    console.error('[cron/merch-shop-custom]', error.message)
    return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  }

  const stripe = getStripeFetch()
  const rows = (data ?? []) as MerchShopOrderRow[]

  for (const row of rows) {
    await processShopOrderAutosend(admin, row, {
      loadSession: async (sessionId) => {
        try {
          return await stripe.checkout.sessions.retrieve(sessionId, { expand: ['customer_details'] })
        } catch {
          return null
        }
      },
    })
  }

  return NextResponse.json({ ok: true, processed: rows.length })
}
