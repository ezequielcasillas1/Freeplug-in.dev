import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { isPlansCheckoutAllowed } from '@/lib/dashboard/plans-eligibility'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import {
  ADDON_MONTHLY_CENTS,
  clampHostingCents,
} from '@/lib/stripe/config'
import {
  applyUserToCheckoutSession,
  getCheckoutSessionContext,
} from '@/lib/stripe/checkout-context'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Sign in to start checkout.' },
        { status: 401 }
      )
    }
    if (!(await isPlansCheckoutAllowed(supabaseAuth, user.id))) {
      return NextResponse.json(
        {
          error:
            'Submit a website request from your dashboard before choosing a hosting plan.',
        },
        { status: 403 }
      )
    }

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

    const ctx = await getCheckoutSessionContext()
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

    const session = await stripe.checkout.sessions.create(
      applyUserToCheckoutSession(
        {
          mode: 'subscription',
          line_items: lineItems,
        },
        ctx,
        {
          type: 'hosting',
          hosting_monthly_cents: String(hostingCents),
          include_addon: includeAddon ? 'true' : 'false',
        }
      )
    )

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
