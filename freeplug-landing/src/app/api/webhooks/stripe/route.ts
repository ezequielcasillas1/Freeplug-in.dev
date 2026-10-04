import { NextResponse } from 'next/server'
import { invoiceTipCents } from '@/lib/plans/tips'
import { invoicePaidAtIso } from '@/lib/stripe/invoice-paid-at'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCancelNoticeOnce } from '@/lib/email/cancel-notice'
import { websiteAccessAfterSubscriptionEvent, type WebsiteAccessStatus } from '@/lib/website-access'
import { handleOutreachInvoicePaid, handleOutreachSetupSession } from '@/lib/outreach/server'
import { supabasePlanStepStore, syncPlanStepForCustomer } from '@/lib/plans/plan-step-sync'
import { flagUnsoldPurchase, supabaseUnsoldPurchaseStore } from '@/lib/plans/unsold-purchase'
import { releaseScheduleIfSwitched } from '@/lib/stripe/change-plan'

export const runtime = 'nodejs'

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : (v?.id ?? null))

/** The subscription an invoice bills (current API: parent.subscription_details; older: invoice.subscription). */
function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const legacy = (inv as unknown as { subscription?: string | { id: string } | null }).subscription
  return idOf(inv.parent?.subscription_details?.subscription as string | { id: string } | null | undefined) ?? idOf(legacy)
}

/**
 * Schedule lifecycle (Aria, Oct 3 3:43 PM): release a plan-switch schedule as soon as its switch
 * phase is current. Never fails the webhook: the next read (Plans page, Manage billing, a tip or
 * plan change) releases it lazily anyway.
 */
async function releaseFinishedSchedule(schedule: string | Stripe.SubscriptionSchedule, source: string) {
  try {
    const outcome = await releaseScheduleIfSwitched(getStripe(), schedule)
    if (outcome === 'released') console.info('[webhook] schedule released after the switch', typeof schedule === 'string' ? schedule : schedule.id, source)
  } catch (e) {
    console.error('[webhook] schedule release failed', source, e instanceof Error ? e.message : e)
  }
}

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
      // A step that stopped being sold (ladder.ts sellable=false) but whose open session still got
      // paid: honor it (nothing is canceled) and flag it for admin review. On a write failure answer
      // 500 so Stripe redelivers; the insert is one row per session, so retries are no-ops.
      try {
        const flagged = await flagUnsoldPurchase(
          supabaseUnsoldPurchaseStore(admin as unknown as Parameters<typeof supabaseUnsoldPurchaseStore>[0]),
          session
        )
        if (flagged) console.warn('[webhook] checkout for a step not sold, honored and flagged', session.id, flagged.plan_step)
      } catch (e) {
        console.error('[webhook] unsold-step flag failed', e instanceof Error ? e.message : e)
        return NextResponse.json({ error: 'Unsold-step flag not saved' }, { status: 500 })
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
      // The switch date: Stripe moves the subscription to the schedule's next phase (this event), but
      // sends no subscription_schedule.updated for the phase change (test clocks, Oct 3), so the
      // finished schedule is released from here and from invoice.paid.
      if (event.type === 'customer.subscription.updated' && sub.schedule) {
        await releaseFinishedSchedule(idOf(sub.schedule as string | { id: string }) as string, event.type)
      }
      if (event.type === 'customer.subscription.updated') {
        // Cancellation email, sent once per cancellation (lib/email/cancel-notice.ts) and once per event
        // (the email_sends ledger, lib/email/webhook-email-ledger.ts), inside try/catch: an email or
        // ledger failure (including the claim itself erroring) never turns the webhook into a non-2xx.
        // Resend idempotency key: `<event.id>:subscription-cancelled`.
        try {
          const notice = await sendCancelNoticeOnce(getStripe(), sub, event.id)
          if (notice !== 'not_set_to_cancel') console.info('[webhook] cancel notice', sub.id, notice)
        } catch (e) {
          console.error('[webhook] cancel notice failed', e instanceof Error ? e.message : e)
        }
      }
      // Hosting ladder: cache the plan step on the profile (admin queue). Recomputed from Stripe's
      // current state, so retries and out-of-order events are safe. On failure answer 500 so Stripe
      // redelivers (the cancel email above is ledger-protected against a second send).
      const planCustomerId = getCustomerId(sub.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null)
      if (planCustomerId) {
        try {
          const synced = await syncPlanStepForCustomer(
            { stripe: getStripe(), store: supabasePlanStepStore(admin as unknown as Parameters<typeof supabasePlanStepStore>[0]) },
            planCustomerId
          )
          console.info('[webhook] plan step', sub.id, synced.outcome, synced.stepId ?? 'none')
        } catch (e) {
          console.error('[webhook] plan step sync failed', e instanceof Error ? e.message : e)
          return NextResponse.json({ error: 'Plan step not saved' }, { status: 500 })
        }
      }
      break
    }
    case 'subscription_schedule.updated': {
      // Sent on every schedule edit (a schedule with a phase still ahead is left alone). Stripe did NOT
      // send it at the phase change on test clocks (Oct 3); customer.subscription.updated and
      // invoice.paid cover the switch date.
      await releaseFinishedSchedule(event.data.object as Stripe.SubscriptionSchedule, event.type)
      break
    }
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice
      // The renewal invoice at the switch date: the schedule's switch phase is now current.
      if (inv.billing_reason === 'subscription_cycle') {
        const subId = invoiceSubscriptionId(inv)
        if (subId) {
          try {
            const sub = await getStripe().subscriptions.retrieve(subId)
            const sched = idOf(sub.schedule as string | { id: string } | null)
            if (sched) await releaseFinishedSchedule(sched, event.type)
          } catch (e) {
            console.error('[webhook] invoice.paid schedule check failed', e instanceof Error ? e.message : e)
          }
        }
      }
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

      // created_at = when Stripe says it was paid, not when this delivery landed (Vera, Oct 4): a retried
      // or replayed invoice.paid must not move Customer Since or the Recent activity date forward.
      const paidAt = invoicePaidAtIso(inv)
      const ledgerRow = {
        profile_id: profile.id,
        stripe_invoice_id: inv.id,
        amount_cents: inv.amount_paid,
        ...(paidAt ? { created_at: paidAt } : {}),
      }
      // The tipping system: the tip part of this payment, shown on its own (admin, ledger). The
      // total stays amount_paid, so every existing total is unchanged.
      const tipCents = Math.min(invoiceTipCents(inv), inv.amount_paid)
      let { error: insertErr } = await admin.from('billing_ledger').insert({ ...ledgerRow, tip_cents: tipCents })
      // Before migration 20261003200000 (tip_cents) is applied: never lose the ledger row over the
      // new column. Undefined column (42703) or PostgREST's schema-cache miss (PGRST204) only.
      if (insertErr && (insertErr.code === '42703' || insertErr.code === 'PGRST204')) {
        console.warn('[webhook] billing_ledger.tip_cents missing; row saved without it', inv.id)
        ;({ error: insertErr } = await admin.from('billing_ledger').insert(ledgerRow))
      }

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
          // Everything paid, tips included (Aria, Oct 3 3:31 PM CT): this column feeds the "Total Paid"
          // displays. Pay-to-own will use its own ledger built from invoice lines, not this counter
          // (read-modify-write; see HOSTING-LADDER-NOTES.md "Buyout: existing pieces").
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
