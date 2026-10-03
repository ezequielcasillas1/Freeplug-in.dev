import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCancelNoticeOnce } from '@/lib/email/cancel-notice'
import { websiteAccessAfterSubscriptionEvent, type WebsiteAccessStatus } from '@/lib/website-access'
import { handleOutreachInvoicePaid, handleOutreachSetupSession } from '@/lib/outreach/server'

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
    // Async on purpose (Cloudflare port): on Workers, stripe uses Web Crypto (SubtleCryptoProvider),
    // which only works from the async verifier; the sync constructEvent throws there.
    event = await stripe.webhooks.constructEventAsync(body, sig, secret)
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

  let websiteAccess: WebsiteAccessStatus | undefined

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // Outreach claim: setup-mode Checkout only saves the card (no subscription, no charge).
      if (session.mode === 'setup') {
        try {
          const setup = await handleOutreachSetupSession(session)
          console.info('[webhook] setup session', session.id, setup.handled ? setup.outcome : 'not handled')
        } catch (e) {
          console.error('[webhook] setup session failed', e instanceof Error ? e.message : e)
          return NextResponse.json({ error: 'Setup session not saved' }, { status: 500 })
        }
        break
      }
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
      // Website access is worked out from Stripe on every dashboard/admin read, so nothing is
      // stored here. The webhook recomputes it so the log (and response) shows the new status.
      const sub = event.data.object as Stripe.Subscription
      const access = await websiteAccessAfterSubscriptionEvent(sub)
      websiteAccess = access.status
      console.info('[webhook]', event.type, sub.id, sub.status, 'website access:', access.status)
      if (event.type === 'customer.subscription.updated') {
        // Cancellation email, sent once per cancellation (see lib/email/cancel-notice.ts).
        try {
          const notice = await sendCancelNoticeOnce(getStripe(), sub)
          if (notice !== 'not_set_to_cancel') console.info('[webhook] cancel notice', sub.id, notice)
        } catch (e) {
          console.error('[webhook] cancel notice failed', e instanceof Error ? e.message : e)
        }
      }
      break
    }
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice
      // Outreach publish: the site goes live once the first invoice is paid (e.g. after 3D Secure).
      try {
        if (await handleOutreachInvoicePaid(inv)) console.info('[webhook] outreach site live', inv.id)
      } catch (e) {
        console.error('[webhook] outreach invoice', e instanceof Error ? e.message : e)
      }
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

  return NextResponse.json(websiteAccess ? { received: true, websiteAccess } : { received: true })
}
