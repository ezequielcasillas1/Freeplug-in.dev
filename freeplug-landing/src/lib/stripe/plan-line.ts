import { LEGACY_ADDON_TIERS, stepByLookupKey } from '../plans/ladder'
import { GRANDFATHERED_HOSTING_ONLY_NAME, GRANDFATHERED_HOSTING_SHORT, LEGACY_ADDON_NAME, PLAN_STRIP_TIP, planStripAddons } from '../plans/ladder-copy'
import { legacyAddonProductId } from './config'

/** Whole dollars like the step rows ("$65"); cents only when they are not zero ("$65.50"). */
export function formatPlanDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

export type PlanLineItem = { lookupKey: string | null; productName: string; unitAmountCents: number; quantity: number; productId?: string | null }

/**
 * The Plans page strip line for one live subscription (round 5, Sable/Lina): "<Name> · $65/month".
 * A ladder plan is named by its step ("Fast lane"), never the product name ("Freeplug Hosting: Fast
 * lane"), so the strip doesn't read "Current plan: Freeplug Hosting: …". A grandfathered plan uses the
 * short display name (Sable, Oct 3 6:28 PM): "Hosting + Pro add-on · $50/month", "Hosting plan · …",
 * WITHOUT a tip part. The status is added when it is not "active".
 * The tipping system: `items` are the plan's items only (never the tip item); a tip is added as its
 * own part ("Fast lane · $65/month + $5 tip"), so the step price and the tip never blur together.
 * Add-ons (Oct 4) are never in `items` either: their monthly total is its own part, before the tip
 * ("Starter · $35/month + $10.75 add-ons + $4 tip"). Ladder plans only.
 */
export function planStripLine(items: ReadonlyArray<PlanLineItem>, interval: string, status: string, tipDollars = 0, addonCents = 0): string {
  const name = planDisplayName(items)
  const ladderStep = items.length === 1 && stepByLookupKey(items[0].lookupKey) != null
  const amount = items.reduce((sum, i) => sum + i.unitAmountCents * i.quantity, 0)
  const suffix = status === 'active' ? '' : ` (${status.replace(/_/g, ' ')})`
  // Ladder plans keep their tip part; a grandfathered line never shows one (Sable 6:28 PM).
  const tip = ladderStep && tipDollars > 0 ? PLAN_STRIP_TIP(formatPlanDollars(tipDollars * 100)) : ''
  const addons = ladderStep && addonCents > 0 ? planStripAddons(addonCents) : ''
  return `${name} · ${formatPlanDollars(amount)}/${interval}${addons}${tip}${suffix}`
}

/**
 * The plan's name from its plan items (never the tip item): the step name for a ladder plan ("Fast
 * lane"), a grandfathered plan's product names joined with " + ".
 */
export function planNameOf(items: ReadonlyArray<Pick<PlanLineItem, 'lookupKey' | 'productName'>>): string {
  const step = items.length === 1 ? stepByLookupKey(items[0].lookupKey) : null
  return step ? step.name : items.map((i) => i.productName).join(' + ')
}

export type PlanDisplayItem = Pick<PlanLineItem, 'lookupKey' | 'productName'> & { productId?: string | null }

/** The retired add-on an item is (product id, else a "<Tier> add-on…" product name, as entitlements read it). */
function legacyAddonOfItem(item: PlanDisplayItem) {
  return (
    LEGACY_ADDON_TIERS.find((t) => item.productId != null && item.productId === legacyAddonProductId(t.id)) ??
    LEGACY_ADDON_TIERS.find((t) => item.productName.startsWith(LEGACY_ADDON_NAME(t.name))) ??
    null
  )
}

/**
 * Sable, Oct 3 6:19 PM: the short display name for cards and Recent activity. A ladder plan is its step
 * name ("Fast lane"); a grandfathered plan is "Hosting + Pro add-on" (add-ons in item order), or
 * "Hosting plan" with no add-on. Plan items only (never the tip item); add a tip with subscriptionListName.
 */
export function planDisplayName(items: ReadonlyArray<PlanDisplayItem>): string {
  const step = items.length === 1 ? stepByLookupKey(items[0].lookupKey) : null
  if (step) return step.name
  const addons = [...new Set(items.map(legacyAddonOfItem).filter((t) => t != null).map((t) => LEGACY_ADDON_NAME(t.name)))]
  return addons.length > 0 ? `${GRANDFATHERED_HOSTING_SHORT} + ${addons.join(' + ')}` : GRANDFATHERED_HOSTING_ONLY_NAME
}

/**
 * Dashboard "Active Subscriptions" list name (Sable, Oct 3 5:11 PM): "Fast lane + $4 tip", the plan
 * strip's tip pattern (PLAN_STRIP_TIP); plan name only without a tip.
 */
export function subscriptionListName(planName: string, tipDollars: number, addonCents = 0): string {
  const addons = addonCents > 0 ? planStripAddons(addonCents) : ''
  return tipDollars > 0 ? `${planName}${addons}${PLAN_STRIP_TIP(formatPlanDollars(tipDollars * 100))}` : `${planName}${addons}`
}
