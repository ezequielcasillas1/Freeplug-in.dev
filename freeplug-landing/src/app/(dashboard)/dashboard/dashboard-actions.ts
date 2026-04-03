'use server'

import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import type Stripe from 'stripe'

export type DashboardStats = {
  totalPaidCents: number
  activeSubscriptionCount: number
  daysSinceFirstPayment: number | null
  websiteStatus: 'live' | 'pending' | 'offline' | 'none'
  invoiceCount: number
}

export type SubscriptionDetail = {
  id: string
  productName: string
  status: Stripe.Subscription.Status
  amount: number
  interval: string
  currentPeriodEnd: Date
  currentPeriodStart: Date
  cancelAtPeriodEnd: boolean
  created: Date
}

export type ActivityItem = {
  id: string
  type: 'payment' | 'request_submitted' | 'request_updated' | 'subscription_created' | 'milestone'
  title: string
  description: string
  date: Date
  amount?: number
}

export type DashboardAlert = {
  id: string
  type: 'info' | 'warning' | 'success' | 'action'
  title: string
  message: string
  actionLabel?: string
  actionHref?: string
}

export type EnhancedDashboardData = {
  stats: DashboardStats
  subscriptions: SubscriptionDetail[]
  recentActivity: ActivityItem[]
  alerts: DashboardAlert[]
}

export async function getEnhancedDashboardData(): Promise<EnhancedDashboardData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'stripe_customer_id, cumulative_website_value_paid_cents, website_value_target_cents, evaluation_status'
    )
    .eq('id', user.id)
    .single()

  const { count: invoiceCount } = await supabase
    .from('billing_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', user.id)

  const { data: billingRecords } = await supabase
    .from('billing_ledger')
    .select('created_at, amount_cents, description')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: requests } = await supabase
    .from('website_requests')
    .select('id, status, business_name, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(5)

  const subscriptions: SubscriptionDetail[] = []
  let activeSubscriptionCount = 0
  let daysSinceFirstPayment: number | null = null
  let websiteStatus: 'live' | 'pending' | 'offline' | 'none' = 'none'

  if (profile?.stripe_customer_id) {
    const stripe = getStripe()

    const subs = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'all',
      limit: 10,
    })

    for (const sub of subs.data) {
      const item = sub.items.data[0]
      if (!item) continue

      const price = item.price
      const product =
        typeof price.product === 'string'
          ? await stripe.products.retrieve(price.product)
          : (price.product as Stripe.Product)

      subscriptions.push({
        id: sub.id,
        productName: product.name,
        status: sub.status,
        amount: price.unit_amount ?? 0,
        interval: price.recurring?.interval ?? 'month',
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        created: new Date(sub.created * 1000),
      })

      if (sub.status === 'active' || sub.status === 'trialing') {
        activeSubscriptionCount++
      }
    }

    const invoices = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      status: 'paid',
      limit: 1,
    })

    if (invoices.data.length > 0 && invoices.data[0].created) {
      const firstPaymentDate = new Date(invoices.data[0].created * 1000)
      const now = new Date()
      daysSinceFirstPayment = Math.floor(
        (now.getTime() - firstPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    }
  }

  if (activeSubscriptionCount > 0) {
    websiteStatus = 'live'
  } else if (profile?.evaluation_status && profile.evaluation_status !== 'none') {
    websiteStatus = 'pending'
  } else if (requests && requests.length > 0) {
    websiteStatus = 'pending'
  }

  const recentActivity: ActivityItem[] = []

  if (billingRecords) {
    for (const record of billingRecords) {
      recentActivity.push({
        id: `payment-${record.created_at}`,
        type: 'payment',
        title: 'Payment received',
        description: record.description || 'Monthly hosting',
        date: new Date(record.created_at),
        amount: record.amount_cents,
      })
    }
  }

  if (requests) {
    for (const req of requests) {
      recentActivity.push({
        id: `request-${req.id}`,
        type: req.status === 'submitted' ? 'request_submitted' : 'request_updated',
        title:
          req.status === 'submitted'
            ? 'Request submitted'
            : req.status === 'in_review'
              ? 'Request in review'
              : 'Request closed',
        description: req.business_name || 'Website request',
        date: new Date(req.updated_at),
      })
    }
  }

  for (const sub of subscriptions) {
    recentActivity.push({
      id: `sub-${sub.id}`,
      type: 'subscription_created',
      title: 'Subscription started',
      description: sub.productName,
      date: sub.created,
    })
  }

  recentActivity.sort((a, b) => b.date.getTime() - a.date.getTime())

  const alerts: DashboardAlert[] = []

  const activeSubscription = subscriptions.find(
    (s) => s.status === 'active' && !s.cancelAtPeriodEnd
  )
  if (activeSubscription) {
    const daysUntilBilling = Math.ceil(
      (activeSubscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (daysUntilBilling <= 7 && daysUntilBilling > 0) {
      alerts.push({
        id: 'upcoming-billing',
        type: 'info',
        title: 'Upcoming billing',
        message: `Your next payment of $${(activeSubscription.amount / 100).toFixed(2)} is due in ${daysUntilBilling} day${daysUntilBilling === 1 ? '' : 's'}.`,
      })
    }
  }

  const cancelingSubscription = subscriptions.find(
    (s) => s.status === 'active' && s.cancelAtPeriodEnd
  )
  if (cancelingSubscription) {
    const daysUntilEnd = Math.ceil(
      (cancelingSubscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    alerts.push({
      id: 'subscription-ending',
      type: 'warning',
      title: 'Subscription ending',
      message: `Your ${cancelingSubscription.productName} will end in ${daysUntilEnd} day${daysUntilEnd === 1 ? '' : 's'}. Resume to keep your website live.`,
      actionLabel: 'Resume plan',
      actionHref: '/dashboard/plans',
    })
  }

  const targetCents = profile?.website_value_target_cents ?? 0
  const paidCents = profile?.cumulative_website_value_paid_cents ?? 0
  if (targetCents > 0 && paidCents >= targetCents) {
    alerts.push({
      id: 'milestone-reached',
      type: 'success',
      title: 'Website value milestone reached!',
      message:
        'Congratulations! You have reached your website value target. You now have options for ownership transfer.',
      actionLabel: 'Learn more',
      actionHref: '/dashboard',
    })
  }

  const openRequest = requests?.find((r) => r.status === 'submitted' || r.status === 'in_review')
  if (!openRequest && subscriptions.length === 0 && (!requests || requests.length === 0)) {
    alerts.push({
      id: 'get-started',
      type: 'action',
      title: 'Get started',
      message: 'Submit a website request to begin your journey with Freeplug.dev.',
      actionLabel: 'Request a website',
      actionHref: '/dashboard/request-website',
    })
  }

  return {
    stats: {
      totalPaidCents: profile?.cumulative_website_value_paid_cents ?? 0,
      activeSubscriptionCount,
      daysSinceFirstPayment,
      websiteStatus,
      invoiceCount: invoiceCount ?? 0,
    },
    subscriptions,
    recentActivity: recentActivity.slice(0, 10),
    alerts,
  }
}
