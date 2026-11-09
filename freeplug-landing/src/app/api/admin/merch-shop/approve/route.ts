import { NextResponse } from 'next/server'
import { isAdminAccessAllowed } from '@/lib/admin/guard'
import { createClient } from '@supabase/supabase-js'
import { approveHeldShopOrder } from '@/lib/merch/shop/fulfillment-jobs'
import type { MerchShopOrdersDb } from '@/lib/merch/shop/orders'

export const runtime = 'nodejs'

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(request: Request) {
  if (!(await isAdminAccessAllowed())) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const body = (await request.json().catch(() => null)) as { stripe_session_id?: unknown } | null
  const sessionId = typeof body?.stripe_session_id === 'string' ? body.stripe_session_id.trim() : ''
  if (!sessionId) return NextResponse.json({ error: 'Missing stripe_session_id' }, { status: 400 })

  const admin = supabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const db = admin as unknown as MerchShopOrdersDb
  const result = await approveHeldShopOrder(db, sessionId, 'admin')
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
