'use server'

import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import type Stripe from 'stripe'

export type SubscriptionInfo = {
  id: string
  status: Stripe.Subscription.Status
  productName: string
  amount: number
  interval: string
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
}

export type CancelPageData = {
  hasStripeCustomer: boolean
  subscriptions: SubscriptionInfo[]
  canceledSubscriptions: SubscriptionInfo[]
  invoiceCount: number
  totalPaidCents: number
}

export async function getCancelPageData(): Promise<CancelPageData | null> {
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
    }
  }

  const stripe = getStripe()

  const subs = await stripe.subscriptions.list({
    customer: profile.stripe_customer_id,
    status: 'all',
    limit: 100,
  })

  const subscriptions: SubscriptionInfo[] = []
  const canceledSubscriptions: SubscriptionInfo[] = []

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
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    }

    if (sub.status === 'canceled' || sub.cancel_at_period_end) {
      canceledSubscriptions.push(info)
    } else if (sub.status === 'active' || sub.status === 'trialing') {
      subscriptions.push(info)
    }
  }

  return {
    hasStripeCustomer: true,
    subscriptions,
    canceledSubscriptions,
    invoiceCount: invoiceCount ?? 0,
    totalPaidCents: profile.cumulative_website_value_paid_cents ?? 0,
  }
}
