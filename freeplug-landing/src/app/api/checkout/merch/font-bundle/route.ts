import { NextResponse } from 'next/server'
import { isSameOriginPost } from '@/app/claim/start/claim-redirect'
import { emailBaseUrl } from '@/lib/site'
import { checkoutSessionExpiresAt } from '@/lib/stripe/checkout-expiry'
import { getStripe } from '@/lib/stripe/server'
import { currentLocale } from '@/i18n/current-locale'
import { buildMerchFontBundleSessionParams } from '@/lib/merch/checkout'
import { isMerchCheckoutEnabled } from '@/lib/merch/flags'
import { isMerchMockCheckoutEnabled, stripeConfigured } from '@/lib/merch/product'
import { createMockCheckoutSessionId } from '@/lib/merch/mock-checkout'
import { merchCheckoutUrls } from '@/lib/merch/checkout'

export const runtime = 'nodejs'

type Body = { email?: unknown }

export async function POST(request: Request) {
  const h = request.headers
  if (h.get('origin') === 'null' || !isSameOriginPost(h.get('origin'), h.get('sec-fetch-site'), request.url, emailBaseUrl())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const locale = await currentLocale()
  const body = (await request.json().catch(() => null)) as Body | null
  const email = typeof body?.email === 'string' && body.email.includes('@') ? body.email.trim() : undefined

  if (!isMerchCheckoutEnabled()) {
    return NextResponse.json({ error: 'Checkout is not open yet.' }, { status: 403 })
  }

  if (!stripeConfigured() && isMerchMockCheckoutEnabled()) {
    const sessionId = createMockCheckoutSessionId()
    const { success } = merchCheckoutUrls(locale)
    const url = success.replace('{CHECKOUT_SESSION_ID}', encodeURIComponent(sessionId))
    return NextResponse.json({ url, mock: true, sessionId })
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      {
        error:
          'Checkout is not configured. Set STRIPE_SECRET_KEY (test mode) or MERCH_MOCK_CHECKOUT=true for a local demo.',
      },
      { status: 503 }
    )
  }

  try {
    const stripe = getStripe()
    const params = buildMerchFontBundleSessionParams(locale, null)
    if (email) params.customer_email = email
    const session = await stripe.checkout.sessions.create({
      ...params,
      expires_at: checkoutSessionExpiresAt(),
    })
    if (!session.url) {
      return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 })
    }
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[checkout/merch/font-bundle]', e)
    return NextResponse.json({ error: 'Checkout failed. Try again later.' }, { status: 500 })
  }
}
