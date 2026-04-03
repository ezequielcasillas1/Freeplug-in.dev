import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/server'
import { clampMaintenanceCents } from '@/lib/stripe/config'
import {
  applyUserToCheckoutSession,
  getCheckoutSessionContext,
} from '@/lib/stripe/checkout-context'

export const runtime = 'nodejs'

/**
 * One-time maintenance Checkout Session (amount chosen in request body).
 * Not used from public UI — maintenance is quote-first; callers should be
 * server-trusted flows (e.g. admin sends invoice) or a future server-determined amount.
 * Keep route for internal/testing until a dedicated “quoted checkout” path exists.
 */
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

    const ctx = await getCheckoutSessionContext()
    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create(
      applyUserToCheckoutSession(
        {
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
        },
        ctx,
        {
          type: 'maintenance',
          maintenance_cents: String(cents),
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
    console.error('[checkout/maintenance]', e)
    return NextResponse.json(
      { error: 'Checkout failed. Try again later.' },
      { status: 500 }
    )
  }
}
