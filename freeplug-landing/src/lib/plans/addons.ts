// Relative imports on purpose: change-plan.ts (loaded by the test-mode probe script through jiti)
// imports this file, outside Next's "@/" alias.
import { ADDONS, ADDON_STEP_LIMITS, type AddonDef, type AddonId, type PlanStepId } from './ladder'

/**
 * Add-ons (Oct 4): classification of Stripe items and the server-side caps. Config (prices, lookup
 * keys, product ids, caps) lives in ladder.ts (ADDONS, ADDON_STEP_LIMITS).
 *
 * Rules:
 *   - An add-on is its own recurring price, quantity 1, at most once per subscription.
 *   - Add-ons never decide the step: the step comes from the plan items only (tips.ts tierItems()).
 *   - Matching is EXACT (lookup key or fixed product id), so the grandfathered add-on prices
 *     (freeplug_addon_<basic|plus|pro>_monthly) are never mistaken for one.
 *   - Caps are checked from live Stripe amounts (or validated Stripe prices), never client input.
 */

type PriceLike = { lookup_key?: string | null; product?: string | { id: string } | null; unit_amount?: number | null }

const productIdOf = (price: PriceLike) => (typeof price.product === 'string' ? price.product : (price.product?.id ?? null))

/** The add-on a price belongs to (exact lookup key, else exact fixed product id), or null. */
export function addonOfPrice(price: PriceLike | null | undefined): AddonDef | null {
  if (!price) return null
  const byKey = price.lookup_key ? ADDONS.find((a) => a.lookupKey === price.lookup_key) : undefined
  if (byKey) return byKey
  const product = productIdOf(price)
  return product ? (ADDONS.find((a) => a.productId === product) ?? null) : null
}

export const isAddonPrice = (price: PriceLike | null | undefined): boolean => addonOfPrice(price) !== null

/** The subscription's add-on items. */
export function addonItemsOf<T extends { price: PriceLike }>(items: readonly T[]): T[] {
  return items.filter((i) => isAddonPrice(i.price))
}

/** Add-on ids on these items, unique, in ADDONS order. */
export function addonIdsOfItems(items: readonly { price: PriceLike }[]): AddonId[] {
  const found = new Set(items.map((i) => addonOfPrice(i.price)?.id).filter((x): x is AddonId => Boolean(x)))
  return ADDONS.filter((a) => found.has(a.id)).map((a) => a.id)
}

/** What the add-on items cost per month, from the Stripe amounts (unit_amount x quantity). */
export function addonCentsOfItems(items: readonly { price: PriceLike; quantity?: number | null }[]): number {
  return addonItemsOf(items).reduce((n, i) => n + Math.max(0, i.price.unit_amount ?? 0) * Math.max(1, i.quantity ?? 1), 0)
}

/** Config price of a set of add-ons (for display and previews before Stripe answers). */
export function addonConfigCents(ids: readonly AddonId[]): number {
  return ADDONS.filter((a) => ids.includes(a.id)).reduce((n, a) => n + a.monthlyCents, 0)
}

/** Untrusted list -> unique known add-on ids (ADDONS order), or null when anything is wrong. */
export function parseAddonIds(value: unknown): AddonId[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > ADDONS.length) return null
  const ids: AddonId[] = []
  for (const v of value) {
    const a = ADDONS.find((x) => x.id === v)
    if (!a || ids.includes(a.id)) return null
    ids.push(a.id)
  }
  return ADDONS.filter((a) => ids.includes(a.id)).map((a) => a.id)
}

export type AddonCapCheck = { ok: true } | { ok: false; code: 'duplicate' | 'over_cap'; maxAddonCents?: number }

/**
 * Server cap check for a step's add-ons: each add-on at most once, and the step's add-on cap
 * (ADDON_STEP_LIMITS, Starter 1500c) from the given Stripe amounts. With today's two add-ons
 * ($10.75) the Starter cap never trips; it is a guard for later prices.
 */
export function addonCapCheck(stepId: PlanStepId, addons: readonly { id: AddonId; cents: number }[]): AddonCapCheck {
  const ids = addons.map((a) => a.id)
  if (new Set(ids).size !== ids.length) return { ok: false, code: 'duplicate' }
  const limit = ADDON_STEP_LIMITS[stepId]
  if (!limit) return { ok: true }
  const total = addons.reduce((n, a) => n + Math.max(0, a.cents), 0)
  if (total > limit.maxAddonCents) return { ok: false, code: 'over_cap', maxAddonCents: limit.maxAddonCents }
  return { ok: true }
}

/** Cents of add-ons that count toward the step's tip total (0 when the step's tip ignores add-ons). */
export function addonCentsInTipTotal(stepId: PlanStepId, addonCents: number): number {
  return ADDON_STEP_LIMITS[stepId]?.addonsInTipTotal ? Math.max(0, addonCents) : 0
}
