'use server'

import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import type Stripe from 'stripe'
import {
  daysUntil,
  stripeTimestampToDate,
  subscriptionPeriodEnd,
  subscriptionPeriodStart,
} from '@/lib/stripe/subscription-dates'
import { RESUME_PLAN_ANCHOR_HREF, subscriptionEndingMessage } from '@/lib/dashboard/subscription-alerts'
import { planDisplayName, planNameOf, subscriptionListName, type PlanDisplayItem } from '@/lib/stripe/plan-line'
import { isTipPrice } from '@/lib/plans/tips'
import { isAddonPrice } from '@/lib/plans/addons'
import { ladderCopy } from '@/lib/plans/ladder-copy'
import { currentLocale } from '@/i18n/current-locale'
import { translatorFor } from '@/i18n/translate'
import { formatUsdIn } from '@/i18n/format'
import { getUserEntitlements } from '@/lib/plans/user-entitlements'
import type { Entitlements } from '@/lib/plans/ladder'
import { periodStartDate } from '@/lib/plans/included-edits'
import { pendingPlanChange } from '@/lib/stripe/change-plan'
import { formatPlanEndDate, isSetToEnd, subscriptionEndDate } from '@/lib/stripe/active-subscription'
import { stepById, stepByLookupKey } from '@/lib/plans/ladder'
import { BILLING_ACTIVITY_COLUMNS, paymentActivityLabel } from '@/lib/dashboard/billing-activity'
import { daysSince, firstPaymentDate } from '@/lib/dashboard/customer-since'

export type DashboardStats = {
  totalPaidCents: number
  activeSubscriptionCount: number
  daysSinceFirstPayment: number | null
  websiteStatus: 'live' | 'pending' | 'offline' | 'none'
  invoiceCount: number
}

export type SubscriptionDetail = {
  id: string
  /** Every item's product name joined with " + " (Recent activity). */
  productName: string
  /** Plan name only, never the tip: "Fast lane" (Subscription ending alert, Sable 5:11 PM). */
  planName?: string
  /** Active Subscriptions list and Recent activity: "Fast lane + $4 tip" (Sable 5:11 / 5:23 PM); plan name only without a tip. */
  listName?: string
  /** True for a hosting-ladder step (the ending alert says "Your Fast lane plan"). */
  ladderStep?: boolean
  status: Stripe.Subscription.Status
  amount: number
  interval: string
  /** Null when Stripe sends no period end (shown as a fallback, never "Invalid Date"). */
  currentPeriodEnd: Date | null
  currentPeriodStart: Date | null
  /** Set to end: cancel at period end, or a cancel_at date on its own (the dashboard shows both as ending). */
  cancelAtPeriodEnd: boolean
  /** When a plan set to end ends (cancel_at, else the period end); null when not set to end. */
  endsAt?: Date | null
  created: Date
  /** Hosting-ladder step or grandfathered plan (null when it couldn't be worked out). */
  entitlements?: Entitlements | null
  /** Included small edit this billing period (Fast lane+ or legacy Plus/Pro); null = not included / unknown. */
  includedEdit?: { used: number; available: number } | null
  /** Big change add-on (Oct 4): used this period of the available one. */
  bigChange?: { used: number; available: number } | null
  /** Add-ons that end at the period end (turned off, or dropped by a planned switch). */
  addonsEnding?: { names: string[]; date: string } | null
  /** A downgrade waiting for the next billing date (Lina §3c); null = none or unknown. */
  pendingChange?: { stepName: string; date: string } | null
}

export type ActivityItem = {
  id: string
  type: 'payment' | 'request_submitted' | 'request_updated' | 'subscription_created'
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
  /** False only when Stripe failed and the caller asked to tolerate it (outreach customers). */
  subscriptionsLoaded: boolean
  recentActivity: ActivityItem[]
  /**
   * False when the payments (billing_ledger) or requests query failed. recentActivity is then
   * empty and the card shows "Couldn't load activity" instead of "No recent activity".
   */
  recentActivityLoaded: boolean
  alerts: DashboardAlert[]
}

/** Server log for a failed activity query: PostgREST code and message only (no user id, no row data). */
function logActivityQueryError(source: string, error: { code?: string; message?: string }) {
  console.error(`[dashboard] recent activity: ${source} query failed`, {
    code: error.code ?? null,
    message: error.message ?? null,
  })
}

/**
 * tolerateStripeErrors (outreach customers only): a failed Stripe lookup leaves the subscriptions
 * empty with subscriptionsLoaded = false instead of failing the page, so the plan box can show
 * Sable's 3:27 line. Organic customers keep the old behaviour (the error propagates).
 */
export async function getEnhancedDashboardData(
  opts: { tolerateStripeErrors?: boolean } = {}
): Promise<EnhancedDashboardData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Every string this builds is in the request's language (Spanish build: alerts, activity, dates).
  const locale = await currentLocale()
  const t = translatorFor(locale)
  const { ADDON_NAMES } = ladderCopy(locale)

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'stripe_customer_id, cumulative_website_value_paid_cents, evaluation_status'
    )
    .eq('id', user.id)
    .single()

  const { count: invoiceCount } = await supabase
    .from('billing_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', user.id)

  const { data: billingRecords, error: billingError } = await supabase
    .from('billing_ledger')
    .select(BILLING_ACTIVITY_COLUMNS)
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)
  if (billingError) logActivityQueryError('billing_ledger', billingError)

  const { data: requests, error: requestsError } = await supabase
    .from('website_requests')
    .select('id, status, business_name, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(5)
  if (requestsError) logActivityQueryError('website_requests', requestsError)

  const recentActivityLoaded = !billingError && !requestsError

  // Customer Since (Vera, Oct 4): the first payment is the oldest billing_ledger row (same source as
  // Total Paid), so renewals and prorations never reset it. A failed read falls back like no rows.
  const { data: firstLedgerRows, error: firstLedgerError } = await supabase
    .from('billing_ledger')
    .select('created_at')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
  if (firstLedgerError) {
    console.error('[dashboard] first payment query failed', {
      code: firstLedgerError.code ?? null,
      message: firstLedgerError.message ?? null,
    })
  }
  const ledgerFirstPayment = firstPaymentDate(
    (firstLedgerRows as { created_at?: string | null }[] | null)?.[0]?.created_at ?? null
  )

  const subscriptions: SubscriptionDetail[] = []
  let activeSubscriptionCount = 0
  let daysSinceFirstPayment: number | null = ledgerFirstPayment ? daysSince(ledgerFirstPayment) : null
  let websiteStatus: 'live' | 'pending' | 'offline' | 'none' = 'none'
  let subscriptionsLoaded = true

  if (profile?.stripe_customer_id) {
    try {
      const stripe = getStripe()

      const subs = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'all',
        limit: 10,
      })

      // Perks shown on the live plan come from the webhook-written snapshot (profiles), so a plan
      // move shows its new perks once Stripe's customer.subscription.updated webhook has landed.
      let planEntitlements: Entitlements | null = null
      try {
        planEntitlements = (await getUserEntitlements(supabase, user.id, profile.stripe_customer_id, stripe)).entitlements
      } catch (e) {
        console.error('[dashboard] entitlements failed', e instanceof Error ? e.message : e)
      }

      for (const sub of subs.data) {
        const items = sub.items.data
        if (items.length === 0) continue

        // Include every line item (e.g. hosting + add-on), not just the first one.
        const productNames: string[] = []
        const planItems: PlanDisplayItem[] = []
        let tipDollars = 0
        let addonCents = 0
        let amount = 0
        for (const item of items) {
          const itemPrice = item.price
          const itemProduct =
            typeof itemPrice.product === 'string'
              ? await stripe.products.retrieve(itemPrice.product)
              : (itemPrice.product as Stripe.Product)
          productNames.push(itemProduct.name)
          if (isTipPrice(itemPrice)) tipDollars += Math.max(0, item.quantity ?? 0)
          // Add-ons (Oct 4): never part of the plan's name; their total is its own part of listName.
          else if (isAddonPrice(itemPrice)) addonCents += (itemPrice.unit_amount ?? 0) * (item.quantity ?? 1)
          else planItems.push({ lookupKey: itemPrice.lookup_key ?? null, productName: itemProduct.name, productId: itemProduct.id ?? null })
          amount += (itemPrice.unit_amount ?? 0) * (item.quantity ?? 1)
        }
        const planName = planItems.length > 0 ? planNameOf(planItems) : productNames.join(' + ')
        const ladderStep = planItems.length === 1 && stepByLookupKey(planItems[0].lookupKey) != null
        const price = items[0].price
        const entitlements: Entitlements | null =
          sub.status === 'active' || sub.status === 'trialing' ? planEntitlements : null
        let pendingChange: SubscriptionDetail['pendingChange'] = null
        let addonsEnding: SubscriptionDetail['addonsEnding'] = null
        if ((sub.status === 'active' || sub.status === 'trialing') && sub.schedule) {
          try {
            const p = await pendingPlanChange(stripe, sub)
            const date = p ? formatPlanEndDate(new Date(p.effectiveAt), locale) : ''
            if (p?.isSwitch) pendingChange = { stepName: stepById(p.step).name, date }
            if (p && p.removedAddons.length > 0) addonsEnding = { names: p.removedAddons.map((a) => ADDON_NAMES[a]), date }
          } catch (e) {
            console.error('[dashboard] pending change lookup failed', e instanceof Error ? e.message : e)
          }
        }

        subscriptions.push({
          id: sub.id,
          productName: productNames.join(' + '),
          planName,
          // Sable 6:19 PM: grandfathered list / Recent activity name "Hosting + Pro add-on" (+ tip); the
          // ending alert keeps planName (the product names, read by grandfatheredAlertName).
          listName: subscriptionListName(planItems.length > 0 ? planDisplayName(planItems, locale) : planName, tipDollars, addonCents, locale),
          ladderStep,
          status: sub.status,
          amount,
          interval: price.recurring?.interval ?? 'month',
          // Period dates live on the subscription items in current Stripe API versions.
          currentPeriodEnd: subscriptionPeriodEnd(sub),
          currentPeriodStart: subscriptionPeriodStart(sub),
          cancelAtPeriodEnd: isSetToEnd(sub),
          endsAt: isSetToEnd(sub) ? subscriptionEndDate(sub) : null,
          created: stripeTimestampToDate(sub.created) ?? new Date(0),
          entitlements,
          includedEdit: null,
          bigChange: null,
          pendingChange,
          addonsEnding,
        })

        if (sub.status === 'active' || sub.status === 'trialing') {
          activeSubscriptionCount++
        }
      }

      // Included small edit: one per billing period, counted in included_edit_uses (owner can
      // select own rows). A missing table or a read error just hides the line.
      for (const detail of subscriptions) {
        const avail = detail.entitlements?.includedEditsPerMonth ?? 0
        const start = periodStartDate(detail.currentPeriodStart)
        if (avail < 1 || !start || (detail.status !== 'active' && detail.status !== 'trialing')) continue
        const { count, error: useErr } = await supabase
          .from('included_edit_uses')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('period_start', start)
        if (!useErr) detail.includedEdit = { used: count ?? 0, available: avail }
      }
      // Big change add-on (Oct 4): counted in big_change_uses the same way; hidden on any error.
      for (const detail of subscriptions) {
        const avail = detail.entitlements?.bigChangesPerMonth ?? 0
        const start = periodStartDate(detail.currentPeriodStart)
        if (avail < 1 || !start || (detail.status !== 'active' && detail.status !== 'trialing')) continue
        const { count, error: useErr } = await supabase
          .from('big_change_uses')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('period_start', start)
        if (!useErr) detail.bigChange = { used: count ?? 0, available: avail }
      }

      // No ledger rows yet (e.g. the invoice.paid webhook has not landed): the earliest start of the
      // subscriptions listed above that took a payment (incomplete, incomplete_expired, trialing and
      // paused are skipped). No invoices.list call (it returned the NEWEST paid invoice).
      if (!ledgerFirstPayment) {
        const fallback = firstPaymentDate(null, subs.data)
        daysSinceFirstPayment = fallback ? daysSince(fallback) : null
      }
    } catch (e) {
      if (!opts.tolerateStripeErrors) throw e
      console.error('[dashboard] Stripe lookup failed', e instanceof Error ? e.message : e)
      subscriptions.length = 0
      activeSubscriptionCount = 0
      // The ledger date does not depend on Stripe, so it still shows; only the fallback is dropped.
      daysSinceFirstPayment = ledgerFirstPayment ? daysSince(ledgerFirstPayment) : null
      subscriptionsLoaded = false
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
        id: `payment-${record.id ?? record.created_at}`,
        type: 'payment',
        title: t('dashboard.activity.title.paymentReceived'),
        description: paymentActivityLabel(record.amount_cents, record.created_at, locale, t),
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
            ? t('dashboard.activity.title.requestSubmitted')
            : req.status === 'in_review'
              ? t('dashboard.activity.title.requestReview')
              : t('dashboard.activity.title.requestClosed'),
        description: req.business_name || t('dashboard.activity.description.websiteRequest'),
        date: new Date(req.updated_at),
      })
    }
  }

  for (const sub of subscriptions) {
    recentActivity.push({
      id: `sub-${sub.id}`,
      type: 'subscription_created',
      title: t('dashboard.activity.title.subscriptionStarted'),
      description: sub.listName ?? sub.productName,
      date: sub.created,
    })
  }

  recentActivity.sort((a, b) => b.date.getTime() - a.date.getTime())

  const alerts: DashboardAlert[] = []

  const activeSubscription = subscriptions.find(
    (s) => s.status === 'active' && !s.cancelAtPeriodEnd
  )
  if (activeSubscription) {
    const daysUntilBilling = daysUntil(activeSubscription.currentPeriodEnd)
    // No period end from Stripe: skip the reminder rather than show "NaN days".
    if (daysUntilBilling != null && daysUntilBilling <= 7 && daysUntilBilling > 0) {
      alerts.push({
        id: 'upcoming-billing',
        type: 'info',
        title: t('dashboard.activity.title.upcomingBilling'),
        message: t('dashboard.activity.upcomingBillingMessage', { amount: formatUsdIn(locale, activeSubscription.amount, 2), days: daysUntilBilling }),
      })
    }
  }

  // The one "Subscription ending" card on the dashboard (the website-access "ending" card is gone,
  // next round): it also covers a trial and a cancel_at set on its own, as that card did.
  const cancelingSubscription = subscriptions.find(
    (s) => (s.status === 'active' || s.status === 'trialing') && s.cancelAtPeriodEnd
  )
  if (cancelingSubscription) {
    const daysUntilEnd = daysUntil(cancelingSubscription.endsAt ?? cancelingSubscription.currentPeriodEnd)
    alerts.push({
      id: 'subscription-ending',
      type: 'warning',
      title: t('dashboard.activity.title.subscriptionEnding'),
      message: subscriptionEndingMessage(cancelingSubscription.planName ?? cancelingSubscription.productName, daysUntilEnd, cancelingSubscription.ladderStep === true, locale),
      actionLabel: t('dashboard.activity.actionLabel.resumePlan'),
      actionHref: RESUME_PLAN_ANCHOR_HREF,
    })
  }

  const openRequest = requests?.find((r) => r.status === 'submitted' || r.status === 'in_review')
  if (!openRequest && subscriptions.length === 0 && (!requests || requests.length === 0)) {
    alerts.push({
      id: 'get-started',
      type: 'action',
      title: t('dashboard.activity.title.getStarted'),
      message: t('dashboard.activity.message.submitWebsiteRequestBegin'),
      actionLabel: t('dashboard.activity.actionLabel.requestWebsite'),
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
    subscriptionsLoaded,
    // A failed query shows the error state, never a partial list that looks complete.
    recentActivity: recentActivityLoaded ? recentActivity.slice(0, 10) : [],
    recentActivityLoaded,
    alerts,
  }
}
