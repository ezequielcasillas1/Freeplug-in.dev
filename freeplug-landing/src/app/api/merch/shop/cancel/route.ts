import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findMerchShopOrderBySession, updateMerchShopOrderBySession, type MerchShopOrdersDb } from '@/lib/merch/shop/orders'
import { refundMerchShopPaymentIntent } from '@/lib/merch/shop/stripe-refund'
import { getStripeFetch } from '@/lib/stripe/server'

export const runtime = 'nodejs'

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Buyer cancel within the 1-hour window after payment (custom autosend orders). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { session_id?: unknown; email?: unknown } | null
  const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : ''
  const emailClaim = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

  const admin = supabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const db = admin as unknown as MerchShopOrdersDb
  const row = await findMerchShopOrderBySession(db, sessionId)
  if (!row) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (row.status !== 'paid_cancellable') return NextResponse.json({ error: 'Not cancellable' }, { status: 400 })
  if (row.cancel_until && Date.now() > Date.parse(row.cancel_until)) {
    return NextResponse.json({ error: 'Cancel window ended' }, { status: 400 })
  }

  const stripe = getStripeFetch()
  let buyerEmail = row.buyer_email?.toLowerCase() ?? ''
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    buyerEmail = (session.customer_details?.email ?? session.customer_email ?? buyerEmail).toLowerCase()
  } catch {
    /* keep row email */
  }
  if (!buyerEmail || emailClaim !== buyerEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!row.stripe_payment_intent_id) {
    return NextResponse.json({ error: 'Payment missing' }, { status: 400 })
  }
  const refunded = await refundMerchShopPaymentIntent(row.stripe_payment_intent_id, 'buyer_cancel_1h')
  if (!refunded.ok) return NextResponse.json({ error: 'Refund failed' }, { status: 500 })
  await updateMerchShopOrderBySession(db, sessionId, { status: 'cancelled', failure_detail: 'buyer_cancel' })
  return NextResponse.json({ ok: true })
}
