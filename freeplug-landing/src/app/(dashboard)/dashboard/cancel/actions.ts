'use server'

import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import type Stripe from 'stripe'
import { stripeTimestampToDate, subscriptionPeriodEnd } from '@/lib/stripe/subscription-dates'
import { pendingPlanChange } from '@/lib/stripe/change-plan'
import { isSetToEnd, subscriptionEndDate } from '@/lib/stripe/active-subscription'
import { stepById } from '@/lib/plans/ladder'
import { planNameOf } from '@/lib/stripe/plan-line'
import { tierItems, tipDollarsOfItems } from '@/lib/plans/tips'

export type SubscriptionInfo = {
  id: string
  status: Stripe.Subscription.Status
  productName: string
  /** Plan card heading (Sable 5:23 PM): the step name for a ladder plan ("Fast lane"); a grandfathered plan keeps its product name. */
  planName?: string
  /** The plan (tier) price × quantity, without the tip. */
  amount: number
  /** The monthly tip on this subscription (0 = none); shown next to the plan price (Vera bug 4). */
  tipCents?: number
  interval: string
  /**
   * Null when Stripe sends no period end (shown as a fallback, never "Invalid Date"). For a plan set to
   * end it is when it ends (cancel_at, else the period end).
   */
  currentPeriodEnd: Date | null
  /** Set to end: cancel at period end, or a cancel_at date on its own (both get the Resume box). */
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
  /** A ladder downgrade waiting for the next billing date (subscription schedule), else null. */
  pendingChange?: { stepName: string; effectiveAt: Date } | null
}

export type CancelPageData = {
  hasStripeCustomer: boolean
  subscriptions: SubscriptionInfo[]
  canceledSubscriptions: SubscriptionInfo[]
  invoiceCount: number
  totalPaidCents: number
  /**
   * False when the Stripe lookup failed and the caller asked to tolerate it (claimed outreach
   * customers, same as the dashboard): the lists are then empty and must not be read as "no plan".
   */
  subscriptionsLoaded: boolean
}

/**
 * tolerateStripeErrors (claimed outreach customers only, like getEnhancedDashboardData): a Stripe
 * error returns empty lists with subscriptionsLoaded=false instead of throwing (no 500). Regular
 * customers keep the old behaviour (the error propagates).
 */
export async function getCancelPageData(
  opts: { tolerateStripeErrors?: boolean } = {}
): Promise<CancelPageData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, cumulative_website_value_paid_cents')
    .eq('id', user.id)
    .single()

  const { count: invoiceCount } = await supabase
    .from('billing_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', user.id)

  if (!profile?.stripe_customer_id) {
    return {
      hasStripeCustomer: false,
      subscriptions: [],
      canceledSubscriptions: [],
      invoiceCount: invoiceCount ?? 0,
      totalPaidCents: profile?.cumulative_website_value_paid_cents ?? 0,
      subscriptionsLoaded: true,
    }
  }

  const subscriptions: SubscriptionInfo[] = []
  const canceledSubscriptions: SubscriptionInfo[] = []
  try {
    await loadSubscriptions(profile.stripe_customer_id, subscriptions, canceledSubscriptions)
  } catch (e) {
    if (!opts.tolerateStripeErrors) throw e
    console.error('[cancel] Stripe lookup failed', e instanceof Error ? e.message : e)
    return {
      hasStripeCustomer: true,
      subscriptions: [],
      canceledSubscriptions: [],
      invoiceCount: invoiceCount ?? 0,
      totalPaidCents: profile.cumulative_website_value_paid_cents ?? 0,
      subscriptionsLoaded: false,
    }
  }

  return {
    hasStripeCustomer: true,
    subscriptions,
    canceledSubscriptions,
    invoiceCount: invoiceCount ?? 0,
    totalPaidCents: profile.cumulative_website_value_paid_cents ?? 0,
    subscriptionsLoaded: true,
  }
}

async function loadSubscriptions(
  customerId: string,
  subscriptions: SubscriptionInfo[],
  canceledSubscriptions: SubscriptionInfo[]
): Promise<void> {
  const stripe = getStripe()

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  })

  for (const sub of subs.data) {
    // The plan item, never the tip item (item order isn't guaranteed); the tip is shown on its own.
    const tiers = tierItems(sub.items.data)
    const item = tiers[0] ?? sub.items.data[0]
    if (!item) continue

    const price = item.price
    const product =
      typeof price.product === 'string'
        ? await stripe.products.retrieve(price.product)
        : (price.product as Stripe.Product)

    const info: SubscriptionInfo = {
      id: sub.id,
      status: sub.status,
      productName: product.name,
      planName: tiers.length === 1 ? planNameOf([{ lookupKey: price.lookup_key ?? null, productName: product.name }]) : product.name,
      amount: (price.unit_amount ?? 0) * (item.quantity ?? 1),
      tipCents: tipDollarsOfItems(sub.items.data) * 100,
      interval: price.recurring?.interval ?? 'month',
      // Period dates live on the subscription items in current Stripe API versions.
      currentPeriodEnd: isSetToEnd(sub) ? subscriptionEndDate(sub) : subscriptionPeriodEnd(sub),
      cancelAtPeriodEnd: isSetToEnd(sub),
      canceledAt: stripeTimestampToDate(sub.canceled_at),
    }

    if (sub.status === 'canceled' || info.cancelAtPeriodEnd) {
      canceledSubscriptions.push(info)
    } else if (sub.status === 'active' || sub.status === 'trialing') {
      if (sub.schedule) {
        // Stripe won't cancel a plan a schedule manages; the page cancels in the app instead.
        const pending = await pendingPlanChange(stripe, sub).catch(() => null)
        info.pendingChange = pending ? { stepName: stepById(pending.step).name, effectiveAt: new Date(pending.effectiveAt) } : null
      }
      subscriptions.push(info)
    }
  }
}
