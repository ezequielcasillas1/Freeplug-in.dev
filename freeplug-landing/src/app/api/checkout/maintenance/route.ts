import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/server'
import { appBaseUrl, clampMaintenanceCents } from '@/lib/stripe/config'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { maintenanceCents?: unknown }
    const cents = clampMaintenanceCents(body.maintenanceCents)
    if (cents === null) {
      return NextResponse.json(
        { error: 'Invalid amount. Use $50–$100 (whole dollars).' },
        { status: 400 }
      )
    }

    const base = appBaseUrl()
    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Maintenance (one-time)' },
            unit_amount: cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancelled`,
      metadata: {
        type: 'maintenance',
        maintenance_cents: String(cents),
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
    console.error('[checkout/maintenance]', e)
    return NextResponse.json(
      { error: 'Checkout failed. Try again later.' },
      { status: 500 }
    )
  }
}
