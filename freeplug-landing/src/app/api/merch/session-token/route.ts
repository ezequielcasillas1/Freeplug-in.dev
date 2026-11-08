import { NextResponse } from 'next/server'
import { merchServiceRoleClient } from '@/lib/merch/server'
import { getStripeFetch } from '@/lib/stripe/server'
import { stripeConfigured } from '@/lib/merch/product'
import { isMerchMockCheckoutEnabled } from '@/lib/merch/product'
import { isMerchFontBundleSession } from '@/lib/merch/checkout'
import { ensureMockMerchToken, isMockMerchCheckoutSessionId } from '@/lib/merch/mock-checkout'
import { ensureMerchFontBundleToken, buildMerchSessionTokenResponse } from '@/lib/merch/delivery'

export const runtime = 'nodejs'

/**
 * Success page helper: given a Stripe Checkout session id, return the download token once paid.
 * Mock sessions work when MERCH_MOCK_CHECKOUT=true.
 */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id')?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id.' }, { status: 400 })
  }

  let admin: ReturnType<typeof merchServiceRoleClient>
  try {
    admin = merchServiceRoleClient()
  } catch (e) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
  }

  if (isMockMerchCheckoutSessionId(sessionId)) {
    if (!isMerchMockCheckoutEnabled()) {
      return NextResponse.json({ error: 'Mock checkout is disabled.' }, { status: 403 })
    }
    await ensureMockMerchToken(admin, sessionId)
    const payload = await buildMerchSessionTokenResponse(admin, sessionId, 'buyer@example.com', { mock: true })
    if ('error' in payload) {
      return NextResponse.json(payload, { status: 404 })
    }
    return NextResponse.json(payload)
  }

  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 })
  }

  try {
    const stripe = getStripeFetch()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (!isMerchFontBundleSession(session)) {
      return NextResponse.json({ error: 'Not a font bundle checkout.' }, { status: 400 })
    }
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ status: session.payment_status ?? 'unpaid' }, { status: 402 })
    }

    const pi = session.payment_intent
    const paymentIntentId = typeof pi === 'string' ? pi : pi?.id ?? null
    const email = session.customer_details?.email ?? session.customer_email ?? null
    const ensured = await ensureMerchFontBundleToken(admin, {
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      buyerEmail: email,
    })
    if ('error' in ensured) {
      return NextResponse.json({ error: 'Could not issue download.' }, { status: 500 })
    }

    const payload = await buildMerchSessionTokenResponse(admin, sessionId, email)
    if ('error' in payload) {
      return NextResponse.json(payload, { status: 403 })
    }
    if (payload.status === 'paid' && 'unavailable' in payload && payload.unavailable) {
      return NextResponse.json(payload, { status: 200 })
    }
    return NextResponse.json(payload)
  } catch (e) {
    console.error('[merch/session-token]', e)
    return NextResponse.json({ error: 'Could not load checkout session.' }, { status: 500 })
  }
}
