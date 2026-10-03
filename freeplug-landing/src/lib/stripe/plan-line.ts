import { stepByLookupKey } from '../plans/ladder'
import { PLAN_STRIP_TIP } from '../plans/ladder-copy'

/** Whole dollars like the step rows ("$65"); cents only when they are not zero ("$65.50"). */
export function formatPlanDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

export type PlanLineItem = { lookupKey: string | null; productName: string; unitAmountCents: number; quantity: number }

/**
 * The Plans page strip line for one live subscription (round 5, Sable/Lina): "<Name> · $65/month".
 * A ladder plan is named by its step ("Fast lane"), never the product name ("Freeplug Hosting: Fast
 * lane"), so the strip doesn't read "Current plan: Freeplug Hosting: …". Grandfathered plans keep
 * their product names joined with " + ". The status is added when it is not "active".
 * The tipping system: `items` are the plan's items only (never the tip item); a tip is added as its
 * own part ("Fast lane · $65/month + $5 tip"), so the step price and the tip never blur together.
 */
export function planStripLine(items: ReadonlyArray<PlanLineItem>, interval: string, status: string, tipDollars = 0): string {
  const name = planNameOf(items)
  const amount = items.reduce((sum, i) => sum + i.unitAmountCents * i.quantity, 0)
  const suffix = status === 'active' ? '' : ` (${status.replace(/_/g, ' ')})`
  const tip = tipDollars > 0 ? PLAN_STRIP_TIP(formatPlanDollars(tipDollars * 100)) : ''
  return `${name} · ${formatPlanDollars(amount)}/${interval}${tip}${suffix}`
}

/**
 * The plan's name from its plan items (never the tip item): the step name for a ladder plan ("Fast
 * lane"), a grandfathered plan's product names joined with " + ".
 */
export function planNameOf(items: ReadonlyArray<Pick<PlanLineItem, 'lookupKey' | 'productName'>>): string {
  const step = items.length === 1 ? stepByLookupKey(items[0].lookupKey) : null
  return step ? step.name : items.map((i) => i.productName).join(' + ')
}

/**
 * Dashboard "Active Subscriptions" list name (Sable, Oct 3 5:11 PM): "Fast lane + $4 tip", the plan
 * strip's tip pattern (PLAN_STRIP_TIP); plan name only without a tip.
 */
export function subscriptionListName(planName: string, tipDollars: number): string {
  return tipDollars > 0 ? `${planName}${PLAN_STRIP_TIP(formatPlanDollars(tipDollars * 100))}` : planName
}
