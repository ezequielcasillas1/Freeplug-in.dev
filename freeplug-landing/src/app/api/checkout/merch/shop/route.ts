import { NextResponse } from 'next/server'
import { isSameOriginPost } from '@/app/claim/start/claim-redirect'
import { emailBaseUrl } from '@/lib/site'
import { checkoutSessionExpiresAt } from '@/lib/stripe/checkout-expiry'
import { getStripeFetch } from '@/lib/stripe/server'
import { currentLocale } from '@/i18n/current-locale'
import { isMerchCheckoutEnabled, isMerchShopEnabled } from '@/lib/merch/flags'
import { stripeConfigured } from '@/lib/merch/product'
import { validateShopCheckoutLine } from '@/lib/merch/shop/catalog'
import { buildMerchShopSessionParams } from '@/lib/merch/shop/checkout'
import { merchShopCustomDesignFeeCents } from '@/lib/merch/shop/config'
import { rateCheck } from '@/lib/rate-limit'
import { clientIpFrom } from '@/lib/rate-limit/client-ip'

export const runtime = 'nodejs'

const IP_LIMIT = { bucket: 'merch_shop_checkout_ip', limit: 30, windowSeconds: 3600 }

type Body = {
  slug?: unknown
  variant_id?: unknown
  quantity?: unknown
  design_mode?: unknown
  custom_upload_path?: unknown
  custom_placement?: unknown
  rights_confirmed?: unknown
  unitAmountCents?: unknown
  price?: unknown
}

export async function POST(request: Request) {
  const h = request.headers
  if (h.get('origin') === 'null' || !isSameOriginPost(h.get('origin'), h.get('sec-fetch-site'), request.url, emailBaseUrl())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isMerchShopEnabled() || !isMerchCheckoutEnabled()) {
    return NextResponse.json({ error: 'Shop checkout is not open yet.' }, { status: 403 })
  }

  const ip = clientIpFrom(h)
  if (!(await rateCheck(IP_LIMIT, ip))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const locale = await currentLocale()
  const body = (await request.json().catch(() => null)) as Body | null
  if (!body) return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })

  if (body.unitAmountCents != null || body.price != null) {
    return NextResponse.json({ error: 'Price must not be sent from the client.' }, { status: 400 })
  }

  const validated = validateShopCheckoutLine(body, merchShopCustomDesignFeeCents())
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: 'Checkout is not configured. Set STRIPE_SECRET_KEY (test mode) for merch checkout.' },
      { status: 503 }
    )
  }

  try {
    const stripe = getStripeFetch()
    const params = buildMerchShopSessionParams(locale, validated.line)
    const session = await stripe.checkout.sessions.create({
      ...params,
      expires_at: checkoutSessionExpiresAt(),
    })
    if (!session.url) {
      return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500 })
    }
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[checkout/merch/shop]', e)
    return NextResponse.json({ error: 'Checkout failed. Try again later.' }, { status: 500 })
  }
}
