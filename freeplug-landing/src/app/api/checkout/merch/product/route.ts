import { NextResponse } from 'next/server'
import { isSameOriginPost } from '@/app/claim/start/claim-redirect'
import { emailBaseUrl } from '@/lib/site'
import { checkoutSessionExpiresAt } from '@/lib/stripe/checkout-expiry'
import { getStripeFetch } from '@/lib/stripe/server'
import { currentLocale } from '@/i18n/current-locale'
import { isMerchCollectionsEnabled } from '@/lib/merch/flags'
import { stripeConfigured } from '@/lib/merch/product'
import { buildMerchCollectionSessionParams } from '@/lib/merch/collections/checkout'
import { validateCollectionCheckoutLine } from '@/lib/merch/collections/catalog'
import { rateCheck } from '@/lib/rate-limit'
import { clientIpFrom } from '@/lib/rate-limit/client-ip'

export const runtime = 'nodejs'

const IP_LIMIT = { bucket: 'merch_collection_checkout_ip', limit: 30, windowSeconds: 3600 }

type Body = {
  collection?: unknown
  slug?: unknown
  option_key?: unknown
  size?: unknown
  color?: unknown
  quantity?: unknown
  unitAmountCents?: unknown
  price?: unknown
}

export async function POST(request: Request) {
  const h = request.headers
  if (h.get('origin') === 'null' || !isSameOriginPost(h.get('origin'), h.get('sec-fetch-site'), request.url, emailBaseUrl())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isMerchCollectionsEnabled()) {
    return NextResponse.json({ error: 'Collection checkout is not open yet.' }, { status: 403 })
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

  const validated = validateCollectionCheckoutLine({
    collection: body.collection,
    slug: body.slug,
    option_key: body.option_key,
    size: body.size,
    color: body.color,
    quantity: body.quantity,
  })
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Checkout is not configured. Set STRIPE_SECRET_KEY (test mode) for merch checkout.',
      },
      { status: 503 }
    )
  }

  try {
    const stripe = getStripeFetch()
    const params = buildMerchCollectionSessionParams(locale, validated.line)
    const session = await stripe.checkout.sessions.create({
      ...params,
      expires_at: checkoutSessionExpiresAt(),
    })
    if (!session.url) {
      return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 })
    }
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[checkout/merch/product]', e)
    return NextResponse.json({ error: 'Checkout failed. Try again later.' }, { status: 500 })
  }
}
