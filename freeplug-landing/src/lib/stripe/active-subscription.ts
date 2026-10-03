import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { isLiveSubscriptionStatus } from './subscription-status'
import { legacyAddonProductId } from '@/lib/stripe/config'
import {
  entitlementsFor,
  isPlanStepId,
  LEGACY_ADDON_TIERS,
  NO_PLAN_ENTITLEMENTS,
  stepByLookupKey,
  type Entitlements,
  type LegacyAddonTierId,
  type PlanStep,
} from '@/lib/plans/ladder'
import { isTipPrice, tierItems, tipDollarsOfItems, tipCentsFor } from '@/lib/plans/tips'
import { stripeTimestampToDate, subscriptionPeriodEnd } from '@/lib/stripe/subscription-dates'
import { planStripLine, type PlanLineItem } from './plan-line'

/** Shown when a customer tries to close their website request while a plan is still active. */
export const CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE =
  "You can't close this request while your plan is active, because your site is still hosted under it. To cancel your plan, choose Cancel options in your dashboard. Once the plan has ended, you can close the request here."

/** Formats a plan end date as "Month D, YYYY" (UTC, so server and client agree). */
export function formatPlanEndDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Short date for buttons: "Nov 3", or "Nov 3, 2027" when the year isn't the current one (UTC, like
 * formatPlanEndDate). Lina, round 5b: "Switch to Starter on Nov 3" fits on one line at 375.
 */
export function formatShortPlanDate(date: Date, now: Date = new Date()): string {
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear()
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  })
}

/** Shown when the plan is still active but already set to end (canceled at period end / cancel_at). */
export function closeBlockedPlanEndingMessage(endsAt: Date | null): string {
  if (!endsAt) {
    return 'Your plan is canceled and ends at the end of the current billing period. You can close this request after that date.'
  }
  return `Your plan is canceled and ends on ${formatPlanEndDate(endsAt)}. You can close this request after that date.`
}

export type ActiveSubscriptionStatus =
  | { active: false; setToEnd: false; endsAt: null }
  | {
      active: true
      /** True only when every active/trialing subscription is already scheduled to end. */
      setToEnd: boolean
      /** When the last scheduled-to-end subscription ends (cancel_at, else current period end). */
      endsAt: Date | null
    }

/** When a subscription set to end ends: cancel_at, else the current period end. */
export function subscriptionEndDate(sub: Stripe.Subscription): Date | null {
  // cancel_at first; otherwise the current period end (items on newer Stripe API versions).
  return stripeTimestampToDate(sub.cancel_at) ?? subscriptionPeriodEnd(sub)
}

/** Set to end: canceled at period end, or a cancel_at date on its own. */
export function isSetToEnd(sub: Pick<Stripe.Subscription, 'cancel_at_period_end' | 'cancel_at'>): boolean {
  return sub.cancel_at_period_end === true || sub.cancel_at != null
}

/**
 * Looks up active/trialing subscriptions for the Stripe customer.
 * A plan canceled at period end is still 'active' in Stripe, so it counts as active (close stays
 * blocked) but is reported with setToEnd/endsAt so the UI can show when it ends.
 * Throws if Stripe cannot be reached, so callers can decide whether to fail closed.
 */
export async function getActiveSubscriptionStatus(
  customerId: string
): Promise<ActiveSubscriptionStatus> {
  const stripe = getStripe()
  const subs: Stripe.Subscription[] = []
  for (const status of ['active', 'trialing'] as const) {
    const res = await stripe.subscriptions.list({ customer: customerId, status, limit: 100 })
    subs.push(...res.data)
  }
  if (subs.length === 0) return { active: false, setToEnd: false, endsAt: null }

  const setToEnd = subs.every(isSetToEnd)
  let endsAt: Date | null = null
  if (setToEnd) {
    for (const sub of subs) {
      const end = subscriptionEndDate(sub)
      if (end && (!endsAt || end > endsAt)) endsAt = end
    }
  }
  return { active: true, setToEnd, endsAt }
}

/**
 * True when the Stripe customer has at least one active or trialing subscription
 * (including ones canceled at period end that have not ended yet).
 * Throws if Stripe cannot be reached, so callers can decide whether to fail closed.
 */
export async function hasActiveOrTrialingSubscription(customerId: string): Promise<boolean> {
  return (await getActiveSubscriptionStatus(customerId)).active
}

// LIVE_SUBSCRIPTION_STATUSES / isLiveSubscriptionStatus live in ./subscription-status (no server
// imports, so scripts can load them); re-exported here for existing callers.
export { LIVE_SUBSCRIPTION_STATUSES, isLiveSubscriptionStatus } from './subscription-status'

/** Shown (409) when a customer with a live plan tries to start another hosting checkout. */
export const ALREADY_HAS_PLAN_MESSAGE =
  'You already have an active hosting plan. Use Manage billing to change it.'

/** Live (billable) subscriptions for the customer. Throws if Stripe cannot be reached. */
export async function listLiveSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
  const stripe = getStripe()
  const res = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  return res.data.filter((s) => isLiveSubscriptionStatus(s.status))
}

/**
 * One line per live subscription for the Plans page strip: "<step name> · $65/month" (see plan-line.ts;
 * grandfathered plans keep their product names), plus the status when it is not "active".
 */
export async function describeLiveSubscriptions(customerId: string): Promise<string[]> {
  const stripe = getStripe()
  const subs = await listLiveSubscriptions(customerId)
  const lines: string[] = []
  for (const sub of subs) {
    const items: PlanLineItem[] = []
    const tipDollars = tipDollarsOfItems(sub.items.data)
    for (const item of sub.items.data) {
      if (isTipPrice(item.price)) continue
      const product =
        typeof item.price.product === 'string'
          ? await stripe.products.retrieve(item.price.product)
          : (item.price.product as Stripe.Product)
      items.push({ lookupKey: item.price.lookup_key ?? null, productName: product.name, unitAmountCents: item.price.unit_amount ?? 0, quantity: item.quantity ?? 1 })
    }
    lines.push(planStripLine(items, tierItems(sub.items.data)[0]?.price.recurring?.interval ?? 'month', sub.status, tipDollars))
  }
  return lines
}

// ------------------------------------------------------------------ entitlements (hosting ladder)

type ProductLike = { id: string; name: string; metadata?: Record<string, string> | null }

/**
 * Entitlements of ONE subscription, from what Stripe holds (no names for new plans):
 *   1. a ladder price: price.lookup_key = freeplug_step_<id>_monthly, else subscription or price
 *      metadata.plan_step;
 *   2. otherwise a grandfathered plan: add-on tier from subscription metadata.addon_tier (outreach
 *      publish), the fixed product id freeplug_addon_<tier>_monthly, or, for pre-ladder dashboard
 *      checkouts whose ad-hoc products carry nothing else, the product name "<Tier> add-on".
 * Legacy plans are only read here, never changed.
 */
export async function entitlementsForSubscription(
  sub: Stripe.Subscription,
  getProduct: (id: string) => Promise<ProductLike>
): Promise<Entitlements> {
  // The tipping system: the tip item never decides the plan. Only tier items are read for the step
  // (and for a legacy plan's hosting amount); the tip is carried separately as tipCents.
  const items = tierItems(sub.items.data)
  const tipCents = tipCentsFor(tipDollarsOfItems(sub.items.data))
  let step: PlanStep | null = null
  for (const item of items) {
    step = stepByLookupKey(item.price.lookup_key) ?? step
    const md = item.price.metadata?.plan_step
    if (!step && isPlanStepId(md)) step = entitlementsFor({ stepId: md }).step
  }
  if (!step && isPlanStepId(sub.metadata?.plan_step)) step = entitlementsFor({ stepId: sub.metadata.plan_step }).step
  if (step) return { ...entitlementsFor({ stepId: step.id }), tipCents }

  // Grandfathered: hosting amount = items that aren't an add-on; tier from metadata/id/name.
  let addonTier: LegacyAddonTierId | null = null
  const mdTier = sub.metadata?.addon_tier
  if (LEGACY_ADDON_TIERS.some((t) => t.id === mdTier)) addonTier = mdTier as LegacyAddonTierId
  let hostingCents = 0
  for (const item of items) {
    const amount = (item.price.unit_amount ?? 0) * (item.quantity ?? 1)
    const monthly = item.price.recurring?.interval === 'year' ? Math.round(amount / 12) : amount
    const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product.id
    let tier = LEGACY_ADDON_TIERS.find((t) => legacyAddonProductId(t.id) === productId)?.id ?? null
    if (!tier) {
      const product =
        typeof item.price.product === 'string'
          ? await getProduct(item.price.product)
          : (item.price.product as unknown as ProductLike)
      tier = LEGACY_ADDON_TIERS.find((t) => product.name?.startsWith(`${t.name} add-on`))?.id ?? null
    }
    if (tier) addonTier = addonTier ?? tier
    else hostingCents += monthly
  }
  return { ...entitlementsFor({ legacy: { hostingCents, addonTier } }), tipCents }
}

/** Best entitlements across the customer's live subscriptions (one plan per customer is enforced). */
export function mergeEntitlements(list: readonly Entitlements[]): Entitlements {
  return list.reduce<Entitlements>(
    (best, e) => (e.priorityRank > best.priorityRank ? e : best),
    NO_PLAN_ENTITLEMENTS
  )
}

/**
 * The customer's plan entitlements (replaces the old name-prefix hasMonthlyEditAddon). Only
 * active/trialing subscriptions count, like the dashboard plan card. Throws if Stripe can't be reached.
 */
export async function getEntitlements(customerId: string, stripe: Stripe = getStripe()): Promise<Entitlements> {
  const res = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  const live = res.data.filter((s) => s.status === 'active' || s.status === 'trialing')
  const getProduct = (id: string) => stripe.products.retrieve(id) as unknown as Promise<ProductLike>
  return mergeEntitlements(await Promise.all(live.map((s) => entitlementsForSubscription(s, getProduct))))
}
