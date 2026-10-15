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
import { sendAddonRefundNoticeOnce } from '@/lib/email/addon-refund-notice'
import { healAddonChargeFromWebhook, healNeedsRedelivery, isAddonChargeInvoice } from '@/lib/stripe/addon-heal-webhook'
import { getAddonPriceId } from '@/lib/stripe/prices'
import { supabasePlanChangeLockStore } from '@/lib/plans/plan-change-lock'
import { healOwedRemovals } from '@/lib/stripe/addon-removal-owed'
import { supabaseRemovalOwedStore, type RemovalOwedDb } from '@/lib/stripe/addon-removal-owed-server'
import { markWebhookEventProcessed, webhookEventState, type WebhookEventsDb } from '@/lib/stripe/webhook-events'

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

  // Phase 4 L-1: an event we already finished answers 200 and does nothing.
  const eventsDb = admin as unknown as WebhookEventsDb
  if ((await webhookEventState(eventsDb, event.id)) === 'processed') {
    return NextResponse.json({ received: true, duplicate: true })
  }

  let websiteAccess: WebsiteAccessStatus | undefined
  /** Set when the add-on self-heal must run again: answered non-2xx AFTER the ledger (replays add no row). */
  let redeliver: string | null = null

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
      // Add-on self-heal (Aria, Oct 4 8:59): the add-on's first-period charge is paid; make sure the
      // add-on item is on the subscription, or refund automatically when it can't be added. Idempotent
      // (fresh Stripe reads, invoice markers, the user's change-plan lock, Stripe idempotency keys).
      if (isAddonChargeInvoice(inv)) {
        try {
          const stripe = getStripe()
          const healed = await healAddonChargeFromWebhook(
            {
              stripe,
              addonPriceIdFor: (id) => getAddonPriceId(id, stripe),
              lockStore: supabasePlanChangeLockStore(admin as unknown as Parameters<typeof supabasePlanChangeLockStore>[0]),
              // Aria 9:27: every refund is explained to the customer (email once per invoice, ledger-guarded).
              notifyRefund: (invoiceId) => sendAddonRefundNoticeOnce(stripe, invoiceId),
            },
            inv
          )
          console.info('[webhook] add-on charge', inv.id, healed.outcome, healed.reason ?? '')
          if (healNeedsRedelivery(healed)) redeliver = `add-on ${healed.outcome}`
        } catch (e) {
          console.error('[webhook] add-on self-heal failed', inv.id, e instanceof Error ? e.message : e)
          redeliver = 'add-on self-heal error'
        }
      }
      // L-1 (Aria 9:57): a renewal that billed an add-on the customer turned off (removal owed): remove
      // the item, refund that line once, clear the flag, tell the customer. Failure = redeliver.
      if (inv.billing_reason === 'subscription_cycle') {
        try {
          const stripe = getStripe()
          const owed = await healOwedRemovals(
            { stripe, store: supabaseRemovalOwedStore(admin as unknown as RemovalOwedDb), notifyRefund: (invoiceId) => sendAddonRefundNoticeOnce(stripe, invoiceId) },
            inv as Parameters<typeof healOwedRemovals>[1]
          )
          if (owed.outcome !== 'none') console.info('[webhook] removal owed', inv.id, owed.outcome)
          if (owed.outcome === 'retry') redeliver = `removal owed ${owed.reason}`
        } catch (e) {
          console.error('[webhook] removal-owed self-heal failed', inv.id, e instanceof Error ? e.message : e)
          redeliver = 'removal-owed self-heal error'
        }
      }
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
        .select('id')
        .eq('stripe_customer_id', customerId)
        .limit(1)

      if (findErr) {
        // Phase 4 L-1: Stripe must retry, or the ledger row and the paid total are lost for good.
        console.error('[webhook] profiles lookup', findErr)
        return NextResponse.json({ error: 'Profile lookup failed' }, { status: 500 })
      }

      const profile = rows?.[0]
      if (!profile) {
        console.warn('[webhook] invoice.paid: no profile for customer', customerId)
        break
      }

      // created_at = when Stripe says it was paid, not when this delivery landed (Vera, Oct 4): a retried
      // or replayed invoice.paid must not move Customer Since or the Recent activity date forward.
      const paidAt = invoicePaidAtIso(inv)
      // The tipping system: the tip part of this payment, shown on its own (admin, ledger). The
      // total stays amount_paid, so every existing total is unchanged.
      const tipCents = Math.min(invoiceTipCents(inv), inv.amount_paid)
      // Phase 4 L-2: the ledger row (unique on the invoice) and the paid total (everything paid, tips and
      // add-ons included; feeds "Total Paid") in ONE transaction: public.record_invoice_paid. A duplicate is a
      // no-op (false); the total is incremented in place, so concurrent invoices for one profile both count.
      const { data: recorded, error: recordErr } = await admin.rpc('record_invoice_paid', {
        p_profile_id: profile.id,
        p_stripe_invoice_id: inv.id,
        p_amount_cents: inv.amount_paid,
        p_tip_cents: tipCents,
        p_paid_at: paidAt,
      })
      if (recordErr) {
        // Phase 4 L-1: Stripe must retry; nothing was saved (one transaction).
        console.error('[webhook] record_invoice_paid', recordErr)
        return NextResponse.json({ error: 'Ledger row not saved' }, { status: 500 })
      }
      if (recorded === false) console.info('[webhook] invoice.paid already recorded', inv.id)
      break
    }
    default:
      break
  }

  if (redeliver) return NextResponse.json({ error: redeliver }, { status: 500 })
  await markWebhookEventProcessed(eventsDb, event.id, event.type)
  return NextResponse.json(websiteAccess ? { received: true, websiteAccess } : { received: true })
}
