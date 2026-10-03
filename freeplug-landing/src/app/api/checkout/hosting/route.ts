import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { isPlansCheckoutAllowed } from '@/lib/dashboard/plans-eligibility'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import { clampHostingCents, resolveAddonTier } from '@/lib/stripe/config'
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
      addonTier?: unknown
      /** Legacy flag from the old single add-on checkbox; maps to Basic. */
      includeAddon?: unknown
    }
    const hostingCents = clampHostingCents(body.hostingMonthlyCents)
    if (hostingCents === null) {
      return NextResponse.json(
        { error: 'Invalid hosting amount. Use $35–$100 (whole dollars).' },
        { status: 400 }
      )
    }
    const addonInput =
      body.addonTier === undefined && body.includeAddon === true
        ? 'basic'
        : body.addonTier
    const addonTier = resolveAddonTier(addonInput)
    if (addonTier === undefined) {
      return NextResponse.json(
        { error: 'Invalid add-on. Choose Basic, Plus, Pro, or no add-on.' },
        { status: 400 }
      )
    }

    const ctx = await getCheckoutSessionContext()
    const stripe = getStripe()

    // One hosting plan per customer: refuse while any subscription is still live/billable.
    // Canceled and ended subscriptions don't count, so a customer whose hosting ended can sign up
    // again. Runs for first-time buyers too (see lib/stripe/checkout-customer.ts). Fails closed
    // (503) if Stripe can't be checked, rather than risk a second plan.
    const addonId = addonTier ? addonTier.id : 'none'
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
        const samePlan = hostingOpen.find(
          (s) =>
            s.url &&
            s.metadata?.hosting_monthly_cents === String(hostingCents) &&
            s.metadata?.addon_tier === addonId
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

    if (addonTier) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${addonTier.name} add-on (monthly)`,
            description: addonTier.includes.join(', '),
          },
          recurring: { interval: 'month' },
          unit_amount: addonTier.monthlyCents,
        },
        quantity: 1,
      })
    }

    // Double-click guard: concurrent requests for the same user + plan (same 10-minute window, same
    // set of just-expired sessions) get the same Checkout Session instead of two.
    const idempotencyKey =
      'hosting-checkout:' +
      createHash('sha256')
        .update(
          [
            user.id,
            customerId ?? 'new',
            hostingCents,
            addonId,
            Math.floor(Date.now() / 600_000),
            expiredSessionIds.join(','),
          ].join('|')
        )
        .digest('hex')

    const session = await stripe.checkout.sessions.create(
      applyUserToCheckoutSession(
        {
          mode: 'subscription',
          line_items: lineItems,
        },
        { ...ctx, stripeCustomerId: customerId },
        {
          type: 'hosting',
          hosting_monthly_cents: String(hostingCents),
          include_addon: addonTier ? 'true' : 'false',
          addon_tier: addonId,
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
