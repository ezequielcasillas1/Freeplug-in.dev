import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { chicagoDayBoundsUtc, customOrdersCapReached } from '@/lib/merch/shop/daily-cap'
import { countCustomOrdersPaidChicagoDay } from '@/lib/merch/shop/orders'
import { isMerchShopEnabled } from '@/lib/merch/flags'

export const runtime = 'nodejs'

export async function GET() {
  if (!isMerchShopEnabled()) {
    return NextResponse.json({ soldOut: true })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ soldOut: false, count: 0 })
  const admin = createClient(url, key, { auth: { persistSession: false } })
  const { start, end, dayKey } = chicagoDayBoundsUtc()
  const count = await countCustomOrdersPaidChicagoDay(admin, start.toISOString(), end.toISOString())
  return NextResponse.json({ soldOut: customOrdersCapReached(count), count, dayKey })
}
