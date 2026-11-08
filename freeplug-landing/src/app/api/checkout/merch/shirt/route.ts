import { NextResponse } from 'next/server'
import { isSameOriginPost } from '@/app/claim/start/claim-redirect'
import { emailBaseUrl } from '@/lib/site'
import { checkoutSessionExpiresAt } from '@/lib/stripe/checkout-expiry'
import { getStripeFetch } from '@/lib/stripe/server'
import { currentLocale } from '@/i18n/current-locale'
import { isMerchShirtsEnabled } from '@/lib/merch/flags'
import { stripeConfigured } from '@/lib/merch/product'
import { buildMerchShirtSessionParams } from '@/lib/merch/shirts/checkout'
import { shirtShippingCents, validateShirtCheckoutLine } from '@/lib/merch/shirts/catalog'
import { rateCheck } from '@/lib/rate-limit'
import { clientIpFrom } from '@/lib/rate-limit/client-ip'

export const runtime = 'nodejs'

const IP_LIMIT = { bucket: 'merch_shirt_checkout_ip', limit: 30, windowSeconds: 3600 }

type Body = {
  slug?: unknown
  color?: unknown
  size?: unknown
  quantity?: unknown
  unitAmountCents?: unknown
  price?: unknown
}

export async function POST(request: Request) {
  const h = request.headers
  if (h.get('origin') === 'null' || !isSameOriginPost(h.get('origin'), h.get('sec-fetch-site'), request.url, emailBaseUrl())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isMerchShirtsEnabled()) {
    return NextResponse.json({ error: 'Shirt checkout is not open yet.' }, { status: 403 })
  }

  const ip = clientIpFrom(h)
  if (!(await rateCheck(IP_LIMIT, ip))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const locale = await currentLocale()
  const body = (await request.json().catch(() => null)) as Body | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  if (body.unitAmountCents != null || body.price != null) {
    return NextResponse.json({ error: 'Price must not be sent from the client.' }, { status: 400 })
  }

  const validated = validateShirtCheckoutLine({
    slug: body.slug,
    color: body.color,
    size: body.size,
    quantity: body.quantity,
  })
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Checkout is not configured. Set STRIPE_SECRET_KEY (test mode) for shirt checkout.',
      },
      { status: 503 }
    )
  }

  try {
    const stripe = getStripeFetch()
    const shippingCents = shirtShippingCents(validated.line.quantity)
    const params = buildMerchShirtSessionParams(locale, validated.line, shippingCents)
    const session = await stripe.checkout.sessions.create({
      ...params,
      expires_at: checkoutSessionExpiresAt(),
    })
    if (!session.url) {
      return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 })
    }
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[checkout/merch/shirt]', e)
    return NextResponse.json({ error: 'Checkout failed. Try again later.' }, { status: 500 })
  }
}
