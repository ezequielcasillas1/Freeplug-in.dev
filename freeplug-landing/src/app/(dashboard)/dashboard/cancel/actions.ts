'use server'

import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import type Stripe from 'stripe'
import { stripeTimestampToDate, subscriptionPeriodEnd } from '@/lib/stripe/subscription-dates'
import { pendingPlanChange } from '@/lib/stripe/change-plan'
import { stepById } from '@/lib/plans/ladder'

export type SubscriptionInfo = {
  id: string
  status: Stripe.Subscription.Status
  productName: string
  amount: number
  interval: string
  /** Null when Stripe sends no period end (shown as a fallback, never "Invalid Date"). */
  currentPeriodEnd: Date | null
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
    const item = sub.items.data[0]
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
      amount: price.unit_amount ?? 0,
      interval: price.recurring?.interval ?? 'month',
      // Period dates live on the subscription items in current Stripe API versions.
      currentPeriodEnd: subscriptionPeriodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end === true,
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
