import { monthlyEditAllowance } from './edit-allowance'
/**
 * Freeplug hosting ladder: the ONE place every tier value lives (Aria's card, Oct 3 2026; approved
 * design, final values still Ezequiel's call). Prices, step names, Stripe lookup keys, AI-edit
 * quotas and which perks each step adds are all here; nothing else hard-codes them.
 *
 * Steps are cumulative: each step includes everything below it. The free $35-$100 slider and the
 * Basic/Plus/Pro add-ons are retired for new sales. Existing add-on subscribers are grandfathered:
 * their entitlements are READ through `entitlementsFor({ legacy })`, never migrated.
 *
 * Customer-facing wording (perk lines, step blurbs) lives in ./ladder-copy.ts (Sable / Wren).
 */

export const PLAN_STEP_IDS = ['starter', 'priority', 'fast_lane', 'leads', 'get_found', 'growth'] as const
export type PlanStepId = (typeof PLAN_STEP_IDS)[number]

/** Perks a step can add. Launch versions only (Aria section 3); "later" perks are not listed. */
export type PlanPerk =
  | 'priorityQueue'
  | 'includedSmallEdit'
  | 'nextBusinessDayEdits'
  | 'leadsReport'
  | 'quoteAlerts'
  | 'gbpManaged'
  | 'reviewKit'
  | 'seasonalRefresh'
  | 'quarterlyCall'
  | 'doneForYouEdits'

export type PlanStep = {
  id: PlanStepId
  /** Display name (placeholder until Sable/Wren confirm; see ladder-copy.ts). */
  name: string
  monthlyCents: number
  /** Stripe Price lookup key (test mode first; live only on Ezequiel's yes). */
  lookupKey: string
  /** Stripe Product id: one product per step, each with one monthly price (Aria section 6.1). */
  productId: string
  /**
   * L2 AI-editor quota per month. Stored only: the L2 editor and enforcement are Part B. NEVER shown
   * to customers while `showAiEditQuota` is false (read it through customerAiEditsPerMonth()).
   */
  aiEditsPerMonth: number
  /** 0 (Starter) .. 5 (Growth partner). Requests queue sorts by this, highest first. */
  rank: number
  /** Perks this step ADDS on top of the steps below it. */
  adds: readonly PlanPerk[]
  /**
   * Can a NEW customer buy or switch to this step? false = shown as "coming soon"; checkout,
   * outreach plan choice/publish and plan switching refuse it ON THE SERVER. Customers already on
   * the step keep it (entitlements, renewals and "keep my plan" are not affected).
   */
  sellable: boolean
}

/**
 * AI-edit quota display (Aria, Oct 3 12:56): false until the L2 AI editor ships. The numbers stay in
 * PLAN_STEPS[].aiEditsPerMonth; there is no quota enforcement. While this is false, no customer-facing
 * output (Plans, pricing, help, emails, claim flow) may show an edit count; the test
 * src/lib/plans/ai-edit-quota-hidden.test.tsx fails if one does. Flip to true only when the editor
 * and its enforcement ship.
 */
export const showAiEditQuota: boolean = false

/** The AI-edit count a customer may see for a step: null while showAiEditQuota is false. */
export function customerAiEditsPerMonth(step: Pick<PlanStep, 'aiEditsPerMonth'>, show: boolean = showAiEditQuota): number | null {
  return show === true ? step.aiEditsPerMonth : null
}

const lookupKeyFor = (id: PlanStepId) => `freeplug_step_${id}_monthly`
const productIdFor = (id: PlanStepId) => `freeplug_step_${id}`

/**
 * sellable (Aria, Oct 3 12:25): Leads, Get found and Growth partner stay false until Ezequiel
 * decides which of their perks he will deliver by hand at launch. Flip one value to sell a step.
 * Starter, Priority and Fast lane stay sellable on their other perks (Aria, Oct 3 12:56); their AI-edit
 * counts are hidden from customers until the AI editor ships (showAiEditQuota below).
 */
export const PLAN_STEPS: readonly PlanStep[] = [
  { id: 'starter', name: 'Starter', monthlyCents: 3500, lookupKey: lookupKeyFor('starter'), productId: productIdFor('starter'), aiEditsPerMonth: 5, rank: 0, adds: [], sellable: true },
  { id: 'priority', name: 'Priority', monthlyCents: 5500, lookupKey: lookupKeyFor('priority'), productId: productIdFor('priority'), aiEditsPerMonth: 15, rank: 1, adds: ['priorityQueue'], sellable: true },
  { id: 'fast_lane', name: 'Fast lane', monthlyCents: 6500, lookupKey: lookupKeyFor('fast_lane'), productId: productIdFor('fast_lane'), aiEditsPerMonth: 15, rank: 2, adds: ['includedSmallEdit', 'nextBusinessDayEdits'], sellable: true },
  { id: 'leads', name: 'Leads', monthlyCents: 7500, lookupKey: lookupKeyFor('leads'), productId: productIdFor('leads'), aiEditsPerMonth: 40, rank: 3, adds: ['leadsReport', 'quoteAlerts'], sellable: false },
  { id: 'get_found', name: 'Get found', monthlyCents: 8500, lookupKey: lookupKeyFor('get_found'), productId: productIdFor('get_found'), aiEditsPerMonth: 40, rank: 4, adds: ['gbpManaged', 'reviewKit'], sellable: false },
  { id: 'growth', name: 'Growth partner', monthlyCents: 10000, lookupKey: lookupKeyFor('growth'), productId: productIdFor('growth'), aiEditsPerMonth: 40, rank: 5, adds: ['seasonalRefresh', 'quarterlyCall', 'doneForYouEdits'], sellable: false },
] as const

// ------------------------------------------------------------------ the tipping system (Oct 3)

/**
 * The tipping system: an optional monthly extra a customer can add on top of a step's price to
 * support Freeplug. It never buys anything: perks, queue order and entitlements come from the STEP
 * only (src/lib/plans/tips.ts has the helpers; tests check a Starter + tip customer is not Priority).
 *
 * Stripe model: ONE subscription = the step's price (quantity 1) + one tip item. The tip item is a
 * single recurring $1/month price (lookup key below, created in test mode by
 * scripts/stripe-test-setup-ladder.mjs) with quantity = tip dollars. A $0 tip = no tip item.
 * Nothing builds an inline price_data.
 */
export const TIP_LOOKUP_KEY = 'freeplug_tip_monthly'
/** Stripe Product id of the tip price (fixed id, like the step products). */
export const TIP_PRODUCT_ID = 'freeplug_tip'
/** One tip unit = $1/month; the item quantity is the tip in whole dollars. */
export const TIP_UNIT_CENTS = 100

/**
 * The monthly TOTAL a customer can choose per step with the slider, in whole dollars (min = the
 * step price, i.e. no tip). EZEQUIEL: change a range here; nothing else hard-codes it. A step whose
 * sellable flag is false gets no slider at all (tipRangeFor() returns null), and the server refuses
 * any tip outside the range (checkout, claim, tip changes).
 */
export const TIP_TOTAL_RANGES: Record<PlanStepId, { minDollars: number; maxDollars: number }> = {
  starter: { minDollars: 35, maxDollars: 54 },
  priority: { minDollars: 55, maxDollars: 64 },
  fast_lane: { minDollars: 65, maxDollars: 74 },
  leads: { minDollars: 75, maxDollars: 84 },
  get_found: { minDollars: 85, maxDollars: 99 },
  growth: { minDollars: 100, maxDollars: 120 },
}

/**
 * Nudge (Aria, Oct 3 round 5b): when the chosen total is within this many dollars of the NEXT step's
 * price and that step is sellable, the slider suggests switching instead. No nudge from the top step.
 * With 5: Starter $50–54, Priority $60–64, Fast lane $70–74 (only once Leads is sold), Leads $80–84,
 * Get found $95–99; Growth partner has no next step.
 */
export const TIP_NUDGE_WINDOW_DOLLARS = 5

// ------------------------------------------------------------------ add-ons (Oct 4, editable)

/**
 * Monthly add-ons on top of any ladder step (Oct 4 spec, Lina's add-ons block). Each is its own
 * recurring Stripe price (lookup key + fixed product id below, created in test mode by
 * scripts/stripe-test-setup-ladder.mjs --addons-only), bought at most once per subscription,
 * charged now when turned on and removed at the end of the billing period.
 *
 * NAMES ARE PLACEHOLDERS (Sable): see ladder-copy.ts ADDON_* for every visible string.
 * The product ids / lookup keys are new on purpose: they never match the grandfathered add-on prices
 * (freeplug_addon_<basic|plus|pro>_monthly), and matching is exact (never by prefix).
 */
export const ADDON_IDS = ['small_edit', 'big_change'] as const
export type AddonId = (typeof ADDON_IDS)[number]

export type AddonDef = {
  id: AddonId
  monthlyCents: number
  lookupKey: string
  productId: string
  /** Extra small edits per billing period on top of the step's included edit. */
  extraSmallEdits: number
  /** Big changes (one larger edit of up to about an hour) per billing period. */
  bigChanges: number
}

export const ADDONS: readonly AddonDef[] = [
  {
    id: 'small_edit',
    monthlyCents: 500,
    lookupKey: 'freeplug_addon_small_edit_monthly',
    productId: 'freeplug_extra_small_edit',
    extraSmallEdits: 1,
    bigChanges: 0,
  },
  {
    id: 'big_change',
    monthlyCents: 575,
    lookupKey: 'freeplug_addon_big_change_monthly',
    productId: 'freeplug_extra_big_change',
    extraSmallEdits: 0,
    bigChanges: 1,
  },
]

/** Add-ons shown as Coming soon on the Plans card (display only: no price, no switch, never sold). */
/** Oct 18 (Cheke): retired add-ons, never shown or sold again. Stripe prices/subscriptions are left as they are. */
export const RETIRED_ADDON_IDS: readonly AddonId[] = ['small_edit', 'big_change']
/** Add-ons shown on the Plans card (none since Oct 18). */
export const VISIBLE_ADDONS: readonly AddonDef[] = ADDONS.filter((a) => !RETIRED_ADDON_IDS.includes(a.id))

export const COMING_SOON_ADDONS = [{ id: 'visitor_snapshot', monthlyCents: 500 }] as const
export const COMING_SOON_ADDON_IDS = COMING_SOON_ADDONS.map((a) => a.id)

/**
 * THE ONE PLACE for add-on caps (Oct 4). EZEQUIEL: change a number here; nothing else hard-codes it.
 *   maxAddonCents     server check only: the step's add-ons may not add up to more than this.
 *   addonsInTipTotal  add-ons count toward the step's TIP_TOTAL_RANGES max, so
 *                     tip max = floor(range max - step price - add-ons). Starter ($54 max):
 *                     $19 with none, $14 with +1 small edit, $13 with Big change, $8 with both.
 * A step not listed here has no add-on cap and its tip range ignores add-ons.
 */
export const ADDON_STEP_LIMITS: Partial<Record<PlanStepId, { maxAddonCents: number; addonsInTipTotal: boolean }>> = {
  starter: { maxAddonCents: 1500, addonsInTipTotal: true },
}

export function addonById(id: unknown): AddonDef | null {
  return ADDONS.find((a) => a.id === id) ?? null
}

/**
 * "Done by end of next business day (Mon-Fri, excluding holidays)" (Fast lane and up): a TARGET,
 * not a guarantee (no refund or credit is tied to it). Due at this hour, Central time, on the next
 * business day after the day of the request. The promise itself still needs Ezequiel's yes.
 */
export const SMALL_EDIT_DUE_HOUR_CT = 17
export const BUSINESS_TIME_ZONE = 'America/Chicago'

// ------------------------------------------------------------------ business holidays (editable)

/**
 * Days the "next business day" target skips, computed for every year. EZEQUIEL: add, remove or
 * change a line here; nothing else needs to change.
 *   { month, day }            the same date every year (month 1-12)
 *   { month, weekday, nth }   the nth weekday of the month (weekday 0 = Sunday .. 6 = Saturday;
 *                             nth 1-4, or -1 for the last one in the month)
 * Weekend holidays follow the federal rule (Aria, Oct 3 12:56; OBSERVE_WEEKEND_HOLIDAYS below): a
 * Saturday holiday is observed on the Friday before, a Sunday holiday on the Monday after. New
 * Year's Day on a Saturday is therefore observed on Dec 31 of the year before.
 */
export type HolidayRule =
  | { name: string; month: number; day: number }
  | { name: string; month: number; weekday: number; nth: 1 | 2 | 3 | 4 | -1 }

export const BUSINESS_HOLIDAYS: readonly HolidayRule[] = [
  { name: "New Year's Day", month: 1, day: 1 },
  { name: 'Memorial Day', month: 5, weekday: 1, nth: -1 },
  { name: 'Independence Day', month: 7, day: 4 },
  { name: 'Labor Day', month: 9, weekday: 1, nth: 1 },
  { name: 'Thanksgiving', month: 11, weekday: 4, nth: 4 },
  { name: 'Christmas Day', month: 12, day: 25 },
]

/**
 * Federal observed-day rule for fixed-date holidays that fall on a weekend: Saturday -> the Friday
 * before, Sunday -> the Monday after. Set to false to skip only the actual date.
 */
export const OBSERVE_WEEKEND_HOLIDAYS: boolean = true

/** One-off closed days ('YYYY-MM-DD', Central calendar date), e.g. '2026-11-27'. Empty for now. */
export const EXTRA_CLOSED_DATES: readonly string[] = []

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** The actual (unmoved) dates of the rules in one calendar year. */
function actualHolidays(year: number, rules: readonly HolidayRule[]): { y: number; m: number; d: number; name: string; fixed: boolean }[] {
  return rules.map((r) => {
    if ('day' in r) return { y: year, m: r.month, d: r.day, name: r.name, fixed: true }
    if (r.nth === -1) {
      const last = new Date(Date.UTC(year, r.month, 0)).getUTCDate()
      const lastWd = new Date(Date.UTC(year, r.month - 1, last)).getUTCDay()
      return { y: year, m: r.month, d: last - ((lastWd - r.weekday + 7) % 7), name: r.name, fixed: false }
    }
    const firstWd = new Date(Date.UTC(year, r.month - 1, 1)).getUTCDay()
    return { y: year, m: r.month, d: 1 + ((r.weekday - firstWd + 7) % 7) + (r.nth - 1) * 7, name: r.name, fixed: false }
  })
}

/**
 * The days closed for holidays in one calendar year, as 'YYYY-MM-DD' Central calendar dates, sorted.
 * `date` is the day we close (the observed day when a fixed-date holiday falls on a weekend),
 * `actual` the holiday itself. Includes next year's New Year's Day when it is observed on Dec 31,
 * and leaves out this year's when it was observed in the year before.
 */
export function holidaysForYear(
  year: number,
  rules: readonly HolidayRule[] = BUSINESS_HOLIDAYS,
  observe: boolean = OBSERVE_WEEKEND_HOLIDAYS
): { date: string; name: string; actual: string }[] {
  const out: { date: string; name: string; actual: string }[] = []
  for (const y of [year - 1, year, year + 1]) {
    for (const h of actualHolidays(y, rules)) {
      const at = new Date(Date.UTC(h.y, h.m - 1, h.d))
      const wd = at.getUTCDay()
      const shift = observe && h.fixed ? (wd === 6 ? -1 : wd === 0 ? 1 : 0) : 0
      const closed = new Date(at.getTime() + shift * 86_400_000)
      if (closed.getUTCFullYear() !== year) continue
      out.push({
        date: ymd(closed.getUTCFullYear(), closed.getUTCMonth() + 1, closed.getUTCDate()),
        name: shift ? `${h.name} (observed)` : h.name,
        actual: ymd(h.y, h.m, h.d),
      })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** Mon-Fri and not a holiday or extra closed day (a Central calendar date). */
export function isBusinessDate(
  year: number,
  month: number,
  day: number,
  rules: readonly HolidayRule[] = BUSINESS_HOLIDAYS,
  extra: readonly string[] = EXTRA_CLOSED_DATES,
  observe: boolean = OBSERVE_WEEKEND_HOLIDAYS
): boolean {
  const wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  if (wd === 0 || wd === 6) return false
  const date = ymd(year, month, day)
  return !extra.includes(date) && !holidaysForYear(year, rules, observe).some((h) => h.date === date)
}

/** Included small edits per billing period at Fast lane and up (no rollover). */
export const INCLUDED_EDITS_PER_PERIOD = 1

/** Stripe Product display name for a step ("Freeplug Hosting: Starter"). */
export const productNameFor = (step: Pick<PlanStep, 'name'>) => `Freeplug Hosting: ${step.name}`

export function isPlanStepId(value: unknown): value is PlanStepId {
  return typeof value === 'string' && (PLAN_STEP_IDS as readonly string[]).includes(value)
}

export function stepById(id: PlanStepId): PlanStep {
  const s = PLAN_STEPS.find((p) => p.id === id)
  if (!s) throw new Error(`Unknown plan step: ${id}`)
  return s
}

/** Server-side resolver for untrusted input: the step, or null for anything unknown. */
export function resolvePlanStep(value: unknown): PlanStep | null {
  return isPlanStepId(value) ? stepById(value) : null
}

/** For NEW sales (checkout, outreach choice/publish, switching to a step): known AND sellable. */
export function resolveSellablePlanStep(value: unknown): PlanStep | null {
  const step = resolvePlanStep(value)
  return step && step.sellable ? step : null
}

export function stepByLookupKey(key: string | null | undefined): PlanStep | null {
  if (!key) return null
  return PLAN_STEPS.find((s) => s.lookupKey === key) ?? null
}

export function stepByRank(rank: number): PlanStep | null {
  return PLAN_STEPS.find((s) => s.rank === rank) ?? null
}

/** Highest step whose price is <= total (legacy plans). Null below Starter. */
export function stepForMonthlyCents(totalCents: number): PlanStep | null {
  let best: PlanStep | null = null
  for (const s of PLAN_STEPS) if (totalCents >= s.monthlyCents) best = s
  return best
}

/** Every perk a step includes (its own plus everything below it). */
export function cumulativePerks(id: PlanStepId): PlanPerk[] {
  const top = stepById(id).rank
  return PLAN_STEPS.filter((s) => s.rank <= top).flatMap((s) => s.adds)
}

// ------------------------------------------------------------------ legacy add-ons (grandfathered)

export type LegacyAddonTierId = 'basic' | 'plus' | 'pro'

/**
 * Retired add-ons. Display and entitlements for existing subscribers ONLY; never offered.
 * Basic's "backups" and "downtime alerts" are deliberately not listed: nothing delivers them yet,
 * so they are not advertised anywhere (Aria, Oct 3).
 */
export const LEGACY_ADDON_TIERS: readonly {
  id: LegacyAddonTierId
  name: string
  monthlyCents: number
  includedEditsPerPeriod: number
  gbpManaged: boolean
}[] = [
  { id: 'basic', name: 'Basic', monthlyCents: 500, includedEditsPerPeriod: 0, gbpManaged: false },
  { id: 'plus', name: 'Plus', monthlyCents: 1000, includedEditsPerPeriod: 1, gbpManaged: false },
  { id: 'pro', name: 'Pro', monthlyCents: 1500, includedEditsPerPeriod: 1, gbpManaged: true },
]

export function legacyAddonById(id: unknown) {
  return LEGACY_ADDON_TIERS.find((t) => t.id === id) ?? null
}

// ------------------------------------------------------------------ entitlements

export type Entitlements = {
  /** The step (new plans), or the step a legacy plan's monthly total reaches (for queue order). */
  step: PlanStep | null
  /** True for grandfathered slider/add-on plans. */
  legacy: boolean
  legacyAddon: LegacyAddonTierId | null
  monthlyCents: number
  priorityRank: number
  /** Edits per billing period: the plan's (edit-allowance.ts; Infinity = unlimited). Legacy Plus/Pro: 1. */
  includedEditsPerMonth: number
  /** Big changes per billing period (the Big change add-on): 0 or 1. */
  bigChangesPerMonth: number
  /** Add-ons on the plan (Oct 4), in ADDONS order. Never a queue rank. */
  addons: AddonId[]
  /** What the add-ons cost per month (live Stripe amounts). Never part of monthlyCents. */
  addonCents: number
  nextBusinessDayEdits: boolean
  leadsReport: boolean
  quoteAlerts: boolean
  gbpManaged: boolean
  reviewKit: boolean
  seasonalRefresh: boolean
  quarterlyCall: boolean
  doneForYouEdits: boolean
  aiEditsPerMonth: number
  /**
   * The tipping system: the customer's monthly tip in cents (0 = none). Billing display only (admin
   * row, plan strip); it NEVER grants a perk or a queue rank, and monthlyCents never includes it.
   */
  tipCents: number
}

export const NO_PLAN_ENTITLEMENTS: Entitlements = {
  step: null,
  legacy: false,
  legacyAddon: null,
  monthlyCents: 0,
  priorityRank: -1,
  includedEditsPerMonth: 0,
  bigChangesPerMonth: 0,
  addons: [],
  addonCents: 0,
  nextBusinessDayEdits: false,
  leadsReport: false,
  quoteAlerts: false,
  gbpManaged: false,
  reviewKit: false,
  seasonalRefresh: false,
  quarterlyCall: false,
  doneForYouEdits: false,
  aiEditsPerMonth: 0,
  tipCents: 0,
}

export type EntitlementInput =
  | { stepId: PlanStepId }
  | { legacy: { hostingCents: number; addonTier: LegacyAddonTierId | 'none' | null } }

export function entitlementsFor(input: EntitlementInput): Entitlements {
  if ('stepId' in input) {
    const step = stepById(input.stepId)
    const perks = new Set(cumulativePerks(step.id))
    return {
      step,
      legacy: false,
      legacyAddon: null,
      monthlyCents: step.monthlyCents,
      priorityRank: step.rank,
      // Oct 18 plan structure: plan edits per month (Growth = unlimited -> Infinity). See edit-allowance.ts.
      includedEditsPerMonth: monthlyEditAllowance(step.id),
      bigChangesPerMonth: 0,
      addons: [],
      addonCents: 0,
      nextBusinessDayEdits: perks.has('nextBusinessDayEdits'),
      leadsReport: perks.has('leadsReport'),
      quoteAlerts: perks.has('quoteAlerts'),
      gbpManaged: perks.has('gbpManaged'),
      reviewKit: perks.has('reviewKit'),
      seasonalRefresh: perks.has('seasonalRefresh'),
      quarterlyCall: perks.has('quarterlyCall'),
      doneForYouEdits: perks.has('doneForYouEdits'),
      aiEditsPerMonth: step.aiEditsPerMonth,
      tipCents: 0,
    }
  }
  // Legacy: keep exactly what was sold. Priority = the bought plan's total (hosting price + add-on)
  // >= $55 (the Sep 25 rule, kept for grandfathered plans only: it is what they paid for, and the old
  // slider price WAS the plan). A tip is never part of hostingCents (callers pass tier items only,
  // see tips.ts tierItems). The included edit comes only from Plus/Pro, GBP only from Pro. No
  // new-ladder perks are granted.
  const addon = legacyAddonById(input.legacy.addonTier)
  const total = Math.max(0, input.legacy.hostingCents) + (addon?.monthlyCents ?? 0)
  const step = stepForMonthlyCents(total)
  return {
    ...NO_PLAN_ENTITLEMENTS,
    step,
    legacy: true,
    legacyAddon: addon?.id ?? null,
    monthlyCents: total,
    priorityRank: step?.rank ?? 0,
    includedEditsPerMonth: addon && addon.includedEditsPerPeriod > 0 ? 1 : 0,
    gbpManaged: addon?.gbpManaged ?? false,
    aiEditsPerMonth: step?.aiEditsPerMonth ?? 0,
  }
}

/**
 * Adds the add-on grants to a plan's entitlements (Oct 4). Add-ons go only on ladder steps (never a
 * grandfathered plan), so a legacy plan or no plan gets nothing from them. Unknown ids are ignored.
 */
export function withAddons(ent: Entitlements, addons: readonly AddonId[], addonCents?: number): Entitlements {
  if (!ent.step || ent.legacy) return ent
  const list = ADDONS.filter((a) => addons.includes(a.id))
  if (list.length === 0) return ent
  // Oct 18: "+1 small edit" and "Big change" are retired. They are still recognized on a subscription
  // (billing display, Stripe untouched) but grant no edits and no Big change any more.
  return {
    ...ent,
    addons: list.map((a) => a.id),
    addonCents: addonCents ?? list.reduce((n, a) => n + a.monthlyCents, 0),
  }
}

/** Queue order helper: higher rank first, then oldest first. */
export function compareQueue(
  a: { priorityRank: number; created_at: string },
  b: { priorityRank: number; created_at: string }
): number {
  if (a.priorityRank !== b.priorityRank) return b.priorityRank - a.priorityRank
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
}
