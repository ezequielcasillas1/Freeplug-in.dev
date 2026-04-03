import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

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

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (e) {
    console.error('[webhook/stripe] admin client', e)
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const supabaseUserId = session.metadata?.supabase_user_id
      const customerId = getCustomerId(session.customer)
      if (supabaseUserId && customerId) {
        const { error } = await admin
          .from('profiles')
          .update({
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', supabaseUserId)

        if (error) {
          console.error('[webhook] profiles update (checkout)', error)
        }
      }
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
      const customerId = getCustomerId(inv.customer)
      if (!customerId || inv.amount_paid <= 0) {
        break
      }

      const { data: rows, error: findErr } = await admin
        .from('profiles')
        .select('id, cumulative_website_value_paid_cents')
        .eq('stripe_customer_id', customerId)
        .limit(1)

      if (findErr) {
        console.error('[webhook] profiles lookup', findErr)
        break
      }

      const profile = rows?.[0]
      if (!profile) {
        console.warn('[webhook] invoice.paid: no profile for customer', customerId)
        break
      }

      const { error: insertErr } = await admin.from('billing_ledger').insert({
        profile_id: profile.id,
        stripe_invoice_id: inv.id,
        amount_cents: inv.amount_paid,
      })

      if (insertErr) {
        if (insertErr.code === '23505') {
          break
        }
        console.error('[webhook] billing_ledger insert', insertErr)
        break
      }

      const prev = profile.cumulative_website_value_paid_cents ?? 0
      const { error: updErr } = await admin
        .from('profiles')
        .update({
          cumulative_website_value_paid_cents: prev + inv.amount_paid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      if (updErr) {
        console.error('[webhook] profiles cumulative update', updErr)
      }
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
