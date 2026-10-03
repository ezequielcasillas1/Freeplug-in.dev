import { createHash } from 'node:crypto'
import { checkoutSessionExpiresAt } from '@/lib/stripe/checkout-expiry'
import { NextResponse } from 'next/server'
import { isPlansCheckoutAllowed } from '@/lib/dashboard/plans-eligibility'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import { resolvePlanStep } from '@/lib/plans/ladder'
import { getStepPriceId, getTipPriceId, PriceNotConfiguredError } from '@/lib/stripe/prices'
import { parseTipDollars, tipLineItems } from '@/lib/plans/tips'
import {
  ALREADY_HAS_PLAN_MESSAGE,
  listLiveSubscriptions,
} from '@/lib/stripe/active-subscription'
import {
  createCheckoutCustomer,
  findCustomersToCheck,
  saveProfileCustomerId,
} from '@/lib/stripe/checkout-customer'
import {
  applyUserToCheckoutSession,
  getCheckoutSessionContext,
} from '@/lib/stripe/checkout-context'
import { hasOutreachPlanWaitingForPublish } from '@/lib/outreach/server'
import { PLAN_WAITING_FOR_PUBLISH_MESSAGE } from '@/lib/outreach/copy'
import { STEP_NOT_SELLABLE_MESSAGE, TIP_OUT_OF_RANGE } from '@/lib/plans/ladder-copy'

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

    const body = (await request.json()) as Record<string, unknown> | null
    // The slider and the Basic/Plus/Pro add-ons are retired for new sales (hosting ladder, Oct 3).
    // Old clients that still send them get a clear 400 instead of a silent step.
    if (
      body &&
      typeof body === 'object' &&
      ('addonTier' in body || 'includeAddon' in body || 'hostingMonthlyCents' in body)
    ) {
      return NextResponse.json(
        { error: 'Add-ons and custom amounts are no longer offered. Choose a hosting plan.' },
        { status: 400 }
      )
    }
    const step = resolvePlanStep(body?.planStep)
    if (!step) {
      return NextResponse.json({ error: 'Invalid hosting plan.' }, { status: 400 })
    }
    // Not sold yet ("coming soon", ladder.ts sellable=false): refused here, whatever the UI sent.
    if (!step.sellable) {
      return NextResponse.json({ error: STEP_NOT_SELLABLE_MESSAGE(step.name), code: 'not_sellable' }, { status: 400 })
    }

    // The tipping system: optional whole-dollar tip inside the step's range (ladder.ts). Refused here,
    // whatever the slider sent; 0 / missing = no tip item.
    const tip = parseTipDollars(step, body?.tipDollars)
    if (!tip.ok) {
      return NextResponse.json({ error: TIP_OUT_OF_RANGE, code: 'tip_out_of_range' }, { status: 400 })
    }
    const tipDollars = tip.tipDollars

    const ctx = await getCheckoutSessionContext()
    const stripe = getStripe()

    // One line item: the Stripe price behind the step's lookup key. Resolved before any open session is
    // expired, and fails closed (503) if the price is missing or doesn't match the ladder amount.
    let priceId: string
    let tipPriceId: string | null = null
    try {
      priceId = await getStepPriceId(step.id, stripe)
      if (tipDollars > 0) tipPriceId = await getTipPriceId(stripe)
    } catch (e) {
      console.error(
        '[checkout/hosting] step price unavailable',
        e instanceof PriceNotConfiguredError ? e.message : e
      )
      return NextResponse.json(
        { error: "We couldn't load hosting prices. Try again in a moment." },
        { status: 503 }
      )
    }

    // One hosting plan per customer: refuse while any subscription is still live/billable.
    // Canceled and ended subscriptions don't count, so a customer whose hosting ended can sign up
    // again. Runs for first-time buyers too (see lib/stripe/checkout-customer.ts). Fails closed
    // (503) if Stripe can't be checked, rather than risk a second plan.
    const expiredSessionIds: string[] = []
    const checkoutUser = ctx.user ?? { id: user.id, email: user.email }
    let customerId: string | null = ctx.stripeCustomerId
    try {
      // Outreach claim: a saved card waiting for publish is already this customer's plan.
      if (await hasOutreachPlanWaitingForPublish(user.id)) {
        return NextResponse.json(
          { error: PLAN_WAITING_FOR_PUBLISH_MESSAGE, code: 'plan_waiting_for_publish' },
          { status: 409 }
        )
      }
      const { customerIds, ownCustomerId } = await findCustomersToCheck(
        stripe,
        checkoutUser,
        ctx.stripeCustomerId
      )
      const live = (
        await Promise.all(customerIds.map((id) => listLiveSubscriptions(id)))
      ).flat()
      if (live.length > 0) {
        // A plan that is canceled but still running ('ending') is resumed from the dashboard
        // ("Restart hosting"), never sold a second time.
        const ending = live.every((s) => s.cancel_at_period_end === true || s.cancel_at != null)
        return NextResponse.json(
          { error: ALREADY_HAS_PLAN_MESSAGE, code: ending ? 'plan_ending' : 'already_has_plan' },
          { status: 409 }
        )
      }
      if (!customerId) {
        customerId = ownCustomerId
        if (customerId) await saveProfileCustomerId(checkoutUser.id, customerId)
        else customerId = await createCheckoutCustomer(stripe, checkoutUser)
      }
    } catch (e) {
      console.error('[checkout/hosting] plan check failed', e)
      return NextResponse.json(
        {
          error:
            "We couldn't check your current plan. Try again in a moment.",
        },
        { status: 503 }
      )
    }
    if (customerId) {
      // Race guard: at most one open hosting checkout per customer. Reuse an open session for the
      // same plan; expire open sessions for a different plan so two tabs can't both be paid.
      try {
        const open = await stripe.checkout.sessions.list({
          customer: customerId,
          status: 'open',
          limit: 10,
        })
        const hostingOpen = open.data.filter(
          (s) => s.mode === 'subscription' && s.metadata?.type === 'hosting'
        )
        // Same plan AND same tip: a session for another tip amount is expired below, never reused.
        const samePlan = hostingOpen.find(
          (s) => s.url && s.metadata?.plan_step === step.id && (s.metadata?.tip_dollars ?? '0') === String(tipDollars)
        )
        if (samePlan?.url) {
          return NextResponse.json({ url: samePlan.url })
        }
        for (const s of hostingOpen) {
          await stripe.checkout.sessions.expire(s.id)
          expiredSessionIds.push(s.id)
        }
      } catch (e) {
        console.error('[checkout/hosting] could not check open sessions', e)
      }
    }

    // Every session expires an hour after it is created (Aria, Oct 3 12:56).
    const expiresAt = checkoutSessionExpiresAt()
    // Double-click guard: concurrent requests for the same user + plan (same minute, so the same
    // expires_at, and the same set of just-expired sessions) get the same Checkout Session.
    const idempotencyKey =
      'hosting-checkout:' +
      createHash('sha256')
        .update(
          [
            user.id,
            customerId ?? 'new',
            step.id,
            String(tipDollars),
            expiresAt,
            expiredSessionIds.join(','),
          ].join('|')
        )
        .digest('hex')

    const session = await stripe.checkout.sessions.create(
      applyUserToCheckoutSession(
        {
          mode: 'subscription',
          expires_at: expiresAt,
          // The step price (quantity 1) + the tip price with quantity = tip dollars (none for $0).
          line_items: [{ price: priceId, quantity: 1 }, ...tipLineItems(tipPriceId, tipDollars)],
          // The subscription carries the step too (webhook + entitlements read it as a fallback
          // to the price's lookup key).
          subscription_data: {
            metadata: {
              type: 'hosting',
              plan_step: step.id,
              tip_dollars: String(tipDollars),
              supabase_user_id: checkoutUser.id,
            },
          },
        },
        { ...ctx, stripeCustomerId: customerId },
        {
          type: 'hosting',
          plan_step: step.id,
          tip_dollars: String(tipDollars),
        }
      ),
      { idempotencyKey }
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
