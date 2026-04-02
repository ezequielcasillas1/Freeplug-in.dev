import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import {
  ADDON_MONTHLY_CENTS,
  appBaseUrl,
  clampHostingCents,
} from '@/lib/stripe/config'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      hostingMonthlyCents?: unknown
      includeAddon?: unknown
    }
    const hostingCents = clampHostingCents(body.hostingMonthlyCents)
    if (hostingCents === null) {
      return NextResponse.json(
        { error: 'Invalid hosting amount. Use $20–$50 (whole dollars).' },
        { status: 400 }
      )
    }
    const includeAddon = Boolean(body.includeAddon)

    const base = appBaseUrl()
    const stripe = getStripe()

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'Hosting plan (monthly)' },
          recurring: { interval: 'month' },
          unit_amount: hostingCents,
        },
        quantity: 1,
      },
    ]

    if (includeAddon) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Hosting add-on (monthly)' },
          recurring: { interval: 'month' },
          unit_amount: ADDON_MONTHLY_CENTS,
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: lineItems,
      success_url: `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancelled`,
      metadata: {
        type: 'hosting',
        hosting_monthly_cents: String(hostingCents),
        include_addon: includeAddon ? 'true' : 'false',
      },
    })

    if (!session.url) {
      return NextResponse.json(
        { error: 'Could not start checkout.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[checkout/hosting]', e)
    const errMsg = e instanceof Error ? e.message : String(e)
    const clientMsg =
      errMsg.includes('STRIPE_SECRET_KEY') ||
      errMsg.includes('Stripe secret key')
        ? errMsg
        : 'Checkout failed. Try again later.'
    return NextResponse.json({ error: clientMsg }, { status: 500 })
  }
}
