import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook/stripe] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    console.error('[webhook/stripe] signature', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      console.info(
        '[webhook] checkout.session.completed',
        session.id,
        session.metadata
      )
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      console.info('[webhook]', event.type, sub.id, sub.status)
      break
    }
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice
      console.info('[webhook] invoice.paid', inv.id)
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
