// Relative imports on purpose: change-plan.ts (loaded by the test-mode probe script through jiti)
// imports this file, outside Next's "@/" alias.
import {
  PLAN_STEPS,
  TIP_LOOKUP_KEY,
  TIP_NUDGE_WINDOW_DOLLARS,
  TIP_PRODUCT_ID,
  TIP_TOTAL_RANGES,
  TIP_UNIT_CENTS,
  type PlanPerk,
  type PlanStep,
  type PlanStepId,
} from './ladder'
import { addonCentsInTipTotal, isAddonPrice } from './addons'

/**
 * The tipping system (Oct 3): helpers shared by checkout, the claim flow, the Plans page, the
 * webhook and admin. Config (ranges, lookup key, nudge distance) lives in ladder.ts.
 *
 * Rules:
 *   - The tip is whole dollars, 0 .. (range max - step price). 0 = no tip item at all.
 *   - Add-ons (Oct 4) count toward the range max on steps marked addonsInTipTotal (Starter):
 *     tip max = floor(range max - step price - add-ons). THE cap rule; ADDON_STEP_LIMITS holds the knobs.
 *   - A step that isn't sellable has no slider and accepts no tip (tipRangeFor = null).
 *   - The tip never grants anything: the step comes from the step price item only (tierItems()).
 *   - Any plan change (upgrade now, downgrade at the next billing date) drops the tip item.
 */

export type TipRange = {
  /** Always 0 (the slider starts at the step price, no tip). */
  minTip: number
  maxTip: number
  /** Monthly totals in whole dollars (step price .. step price + maxTip). */
  minTotal: number
  maxTotal: number
}

type Ranges = Record<PlanStepId, { minDollars: number; maxDollars: number }>

/**
 * The slider range for a step, or null for a step that isn't sold (no slider, no tip). `addonCents` =
 * what the plan's add-ons cost per month; on steps whose tip total includes add-ons (ladder.ts
 * ADDON_STEP_LIMITS, Starter) it lowers the max tip: floor(range max - step price - add-ons).
 */
export function tipRangeFor(
  step: Pick<PlanStep, 'id' | 'monthlyCents' | 'sellable'>,
  ranges: Ranges = TIP_TOTAL_RANGES,
  addonCents: number = 0
): TipRange | null {
  if (!step.sellable) return null
  const price = Math.round(step.monthlyCents / 100)
  const r = ranges[step.id]
  const rangeMax = Math.max(price, Math.floor(r?.maxDollars ?? price))
  const counted = addonCentsInTipTotal(step.id, addonCents)
  const maxTip = Math.max(0, Math.floor((rangeMax * 100 - step.monthlyCents - counted) / 100))
  return { minTip: 0, maxTip, minTotal: price, maxTotal: price + maxTip }
}

export type TipParse = { ok: true; tipDollars: number } | { ok: false; code: 'invalid' | 'out_of_range' | 'not_sellable' }

/**
 * Server-side check of an untrusted tip for a step. Missing/null = 0 (no tip). Anything that isn't a
 * whole number of dollars inside the step's range is refused; a step that isn't sold accepts only 0.
 */
export function parseTipDollars(
  step: Pick<PlanStep, 'id' | 'monthlyCents' | 'sellable'>,
  value: unknown,
  ranges: Ranges = TIP_TOTAL_RANGES,
  addonCents: number = 0
): TipParse {
  if (value === undefined || value === null) return { ok: true, tipDollars: 0 }
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return { ok: false, code: 'invalid' }
  const range = tipRangeFor(step, ranges, addonCents)
  if (!range) return value === 0 ? { ok: true, tipDollars: 0 } : { ok: false, code: 'not_sellable' }
  if (value < range.minTip || value > range.maxTip) return { ok: false, code: 'out_of_range' }
  return { ok: true, tipDollars: value }
}

type PriceLike = { lookup_key?: string | null; product?: string | { id: string } | null }

/** The tip price (by lookup key, or by the fixed tip product id). */
export function isTipPrice(price: PriceLike | null | undefined): boolean {
  if (!price) return false
  if (price.lookup_key === TIP_LOOKUP_KEY) return true
  const product = typeof price.product === 'string' ? price.product : (price.product?.id ?? null)
  return product === TIP_PRODUCT_ID
}

/**
 * Items that make up the plan itself (step price, or a legacy plan's hosting + grandfathered add-on):
 * everything but the tip and the Oct 4 add-ons (addons.ts). The step is read from these only.
 */
export function tierItems<T extends { price: PriceLike }>(items: readonly T[]): T[] {
  return items.filter((i) => !isTipPrice(i.price) && !isAddonPrice(i.price))
}

/** The subscription's tip item, if any. */
export function tipItemOf<T extends { price: PriceLike }>(items: readonly T[]): T | null {
  return items.find((i) => isTipPrice(i.price)) ?? null
}

/** Tip in whole dollars on a subscription's items (0 = none). */
export function tipDollarsOfItems(items: readonly { price: PriceLike; quantity?: number | null }[]): number {
  const tip = tipItemOf(items)
  return tip ? Math.max(0, tip.quantity ?? 0) : 0
}

export const tipCentsFor = (tipDollars: number) => Math.max(0, Math.floor(tipDollars)) * TIP_UNIT_CENTS

/** Checkout / subscription line for a tip: none for 0. */
export function tipLineItems(tipPriceId: string | null, tipDollars: number): { price: string; quantity: number }[] {
  if (!tipPriceId || tipDollars <= 0) return []
  return [{ price: tipPriceId, quantity: tipDollars }]
}

/** The step above `step` in the ladder (by rank), or null at the top. */
export function nextStepUp(step: Pick<PlanStep, 'rank'>): PlanStep | null {
  return PLAN_STEPS.find((s) => s.rank === step.rank + 1) ?? null
}

export type TipNudge = { next: PlanStep; perk: PlanPerk }

/**
 * Nudge: with a tip, when the monthly total is within TIP_NUDGE_WINDOW_DOLLARS of the next step's
 * price and the next step is sellable, suggest switching to it. Never from the top step, never for a
 * $0 tip, never toward a step that isn't sold.
 *
 * Add-ons (Oct 4): they stay on when switching steps, so they are on both sides of the comparison
 * and cancel out; the gap is still next step price - (step price + tip). What `addonCents` changes
 * is the reachable tip: a tip above the add-on-lowered max (tipRangeFor) never nudges, so on
 * Starter with both add-ons ($8 max) the $50+ nudge can't show.
 */
export function tipNudge(
  step: Pick<PlanStep, 'id' | 'rank' | 'monthlyCents' | 'sellable'>,
  tipDollars: number,
  within: number = TIP_NUDGE_WINDOW_DOLLARS,
  addonCents: number = 0
): TipNudge | null {
  if (tipDollars <= 0) return null
  const range = tipRangeFor(step, TIP_TOTAL_RANGES, addonCents)
  if (range && tipDollars > range.maxTip) return null
  const next = nextStepUp(step)
  if (!next || !next.sellable || next.adds.length === 0) return null
  const total = Math.round(step.monthlyCents / 100) + tipDollars
  const gap = Math.round(next.monthlyCents / 100) - total
  if (gap > within) return null
  return { next, perk: next.adds[0] }
}

type InvoiceLineLike = {
  amount?: number | null
  pricing?: { price_details?: { price?: string | { id: string; lookup_key?: string | null } | null; product?: string | { id: string } | null } | null } | null
  price?: PriceLike | null
}

/**
 * Tip cents on an invoice (billing_ledger.tip_cents): the lines whose price is the tip price (by the
 * tip product id on newer Stripe API versions, or the line's price object on older ones). Credits
 * (negative lines) count, so a prorated tip refund lowers it; never below 0.
 */
export function invoiceTipCents(invoice: { lines?: { data?: readonly InvoiceLineLike[] } | null }): number {
  let cents = 0
  for (const line of invoice.lines?.data ?? []) {
    const details = line.pricing?.price_details
    const detailPrice = details?.price && typeof details.price !== 'string' ? details.price : null
    const isTip =
      isTipPrice({ lookup_key: detailPrice?.lookup_key ?? null, product: details?.product ?? null }) || isTipPrice(line.price ?? null)
    if (isTip) cents += line.amount ?? 0
  }
  return Math.max(0, cents)
}
