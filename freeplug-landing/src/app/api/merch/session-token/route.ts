import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'
import { stripeConfigured } from '@/lib/merch/product'
import { isMerchMockCheckoutEnabled } from '@/lib/merch/product'
import { isMerchFontBundleSession } from '@/lib/merch/checkout'
import { ensureMockMerchToken, isMockMerchCheckoutSessionId } from '@/lib/merch/mock-checkout'
import { hashMerchToken, issueMerchFontBundleToken } from '@/lib/merch/tokens'
import { merchDownloadUrl } from '@/lib/merch/email'

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

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 })
  }

  if (isMockMerchCheckoutSessionId(sessionId)) {
    if (!isMerchMockCheckoutEnabled()) {
      return NextResponse.json({ error: 'Mock checkout is disabled.' }, { status: 403 })
    }
    const issued = await ensureMockMerchToken(admin, sessionId)
    if (!issued) {
      const { data } = await admin
        .from('merch_font_bundle_tokens')
        .select('expires_at, revoked_at, max_downloads, download_count')
        .eq('stripe_checkout_session_id', sessionId)
        .maybeSingle()
      if (!data || data.revoked_at) {
        return NextResponse.json({ error: 'No download available.' }, { status: 404 })
      }
      return NextResponse.json({
        status: 'paid',
        message: 'Download was already issued. Check your email or use your saved link.',
        expiresAt: data.expires_at,
      })
    }
    return NextResponse.json({
      status: 'paid',
      token: issued.token,
      downloadUrl: merchDownloadUrl(issued.token),
      expiresAt: issued.expiresAt,
      mock: true,
    })
  }

  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 })
  }

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (!isMerchFontBundleSession(session)) {
      return NextResponse.json({ error: 'Not a font bundle checkout.' }, { status: 400 })
    }
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ status: session.payment_status ?? 'unpaid' }, { status: 402 })
    }

    const { data: existing } = await admin
      .from('merch_font_bundle_tokens')
      .select('token_hash, expires_at, revoked_at')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()

    if (existing?.revoked_at) {
      return NextResponse.json({ error: 'Download revoked.' }, { status: 403 })
    }

    if (existing?.token_hash) {
      return NextResponse.json({
        status: 'paid',
        message: 'Download was already issued. Check your email for the link.',
        expiresAt: existing.expires_at,
      })
    }

    const pi = session.payment_intent
    const paymentIntentId = typeof pi === 'string' ? pi : pi?.id ?? null
    const email = session.customer_details?.email ?? session.customer_email ?? null
    const issued = await issueMerchFontBundleToken(admin, {
      stripeCheckoutSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      buyerEmail: email,
    })
    if ('error' in issued) {
      return NextResponse.json({ error: 'Could not issue download.' }, { status: 500 })
    }
    void hashMerchToken(issued.token)
    return NextResponse.json({
      status: 'paid',
      token: issued.token,
      downloadUrl: merchDownloadUrl(issued.token),
      expiresAt: issued.expiresAt,
    })
  } catch (e) {
    console.error('[merch/session-token]', e)
    return NextResponse.json({ error: 'Could not load checkout session.' }, { status: 500 })
  }
}
