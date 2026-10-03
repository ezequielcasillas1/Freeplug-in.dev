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
  /** L2 AI-editor quota per month. Stored only: the L2 editor and enforcement are Part B. */
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

const lookupKeyFor = (id: PlanStepId) => `freeplug_step_${id}_monthly`
const productIdFor = (id: PlanStepId) => `freeplug_step_${id}`

/**
 * sellable (Aria, Oct 3 12:25): Leads, Get found and Growth partner stay false until Ezequiel
 * decides which of their perks he will deliver by hand at launch. Flip one value to sell a step.
 * OPEN QUESTION (Aria/Ezequiel): Starter, Priority and Fast lane are sellable but advertise AI-edit
 * counts, and the AI-edit quota is not enforced yet (Part B).
 */
export const PLAN_STEPS: readonly PlanStep[] = [
  { id: 'starter', name: 'Starter', monthlyCents: 3500, lookupKey: lookupKeyFor('starter'), productId: productIdFor('starter'), aiEditsPerMonth: 5, rank: 0, adds: [], sellable: true },
  { id: 'priority', name: 'Priority', monthlyCents: 5500, lookupKey: lookupKeyFor('priority'), productId: productIdFor('priority'), aiEditsPerMonth: 15, rank: 1, adds: ['priorityQueue'], sellable: true },
  { id: 'fast_lane', name: 'Fast lane', monthlyCents: 6500, lookupKey: lookupKeyFor('fast_lane'), productId: productIdFor('fast_lane'), aiEditsPerMonth: 15, rank: 2, adds: ['includedSmallEdit', 'nextBusinessDayEdits'], sellable: true },
  { id: 'leads', name: 'Leads', monthlyCents: 7500, lookupKey: lookupKeyFor('leads'), productId: productIdFor('leads'), aiEditsPerMonth: 40, rank: 3, adds: ['leadsReport', 'quoteAlerts'], sellable: false },
  { id: 'get_found', name: 'Get found', monthlyCents: 8500, lookupKey: lookupKeyFor('get_found'), productId: productIdFor('get_found'), aiEditsPerMonth: 40, rank: 4, adds: ['gbpManaged', 'reviewKit'], sellable: false },
  { id: 'growth', name: 'Growth partner', monthlyCents: 10000, lookupKey: lookupKeyFor('growth'), productId: productIdFor('growth'), aiEditsPerMonth: 40, rank: 5, adds: ['seasonalRefresh', 'quarterlyCall', 'doneForYouEdits'], sellable: false },
] as const

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
 * A holiday that falls on a weekend is not moved to the Friday or Monday (weekends are skipped
 * anyway). Add the observed day to EXTRA_CLOSED_DATES if you close then too.
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

/** One-off closed days ('YYYY-MM-DD', Central calendar date), e.g. '2026-11-27'. Empty for now. */
export const EXTRA_CLOSED_DATES: readonly string[] = []

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** The holidays of one calendar year as 'YYYY-MM-DD' (Central calendar dates), with names. */
export function holidaysForYear(
  year: number,
  rules: readonly HolidayRule[] = BUSINESS_HOLIDAYS
): { date: string; name: string }[] {
  return rules.map((r) => {
    if ('day' in r) return { date: ymd(year, r.month, r.day), name: r.name }
    if (r.nth === -1) {
      const last = new Date(Date.UTC(year, r.month, 0)).getUTCDate()
      const lastWd = new Date(Date.UTC(year, r.month - 1, last)).getUTCDay()
      return { date: ymd(year, r.month, last - ((lastWd - r.weekday + 7) % 7)), name: r.name }
    }
    const firstWd = new Date(Date.UTC(year, r.month - 1, 1)).getUTCDay()
    return { date: ymd(year, r.month, 1 + ((r.weekday - firstWd + 7) % 7) + (r.nth - 1) * 7), name: r.name }
  })
}

/** Mon-Fri and not a holiday or extra closed day (a Central calendar date). */
export function isBusinessDate(
  year: number,
  month: number,
  day: number,
  rules: readonly HolidayRule[] = BUSINESS_HOLIDAYS,
  extra: readonly string[] = EXTRA_CLOSED_DATES
): boolean {
  const wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  if (wd === 0 || wd === 6) return false
  const date = ymd(year, month, day)
  return !extra.includes(date) && !holidaysForYear(year, rules).some((h) => h.date === date)
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
  includedEditsPerMonth: 0 | 1
  nextBusinessDayEdits: boolean
  leadsReport: boolean
  quoteAlerts: boolean
  gbpManaged: boolean
  reviewKit: boolean
  seasonalRefresh: boolean
  quarterlyCall: boolean
  doneForYouEdits: boolean
  aiEditsPerMonth: number
}

export const NO_PLAN_ENTITLEMENTS: Entitlements = {
  step: null,
  legacy: false,
  legacyAddon: null,
  monthlyCents: 0,
  priorityRank: -1,
  includedEditsPerMonth: 0,
  nextBusinessDayEdits: false,
  leadsReport: false,
  quoteAlerts: false,
  gbpManaged: false,
  reviewKit: false,
  seasonalRefresh: false,
  quarterlyCall: false,
  doneForYouEdits: false,
  aiEditsPerMonth: 0,
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
      includedEditsPerMonth: perks.has('includedSmallEdit') ? 1 : 0,
      nextBusinessDayEdits: perks.has('nextBusinessDayEdits'),
      leadsReport: perks.has('leadsReport'),
      quoteAlerts: perks.has('quoteAlerts'),
      gbpManaged: perks.has('gbpManaged'),
      reviewKit: perks.has('reviewKit'),
      seasonalRefresh: perks.has('seasonalRefresh'),
      quarterlyCall: perks.has('quarterlyCall'),
      doneForYouEdits: perks.has('doneForYouEdits'),
      aiEditsPerMonth: step.aiEditsPerMonth,
    }
  }
  // Legacy: keep exactly what was sold. Priority = total >= $55 (the Sep 25 rule); the included
  // edit comes only from Plus/Pro, GBP only from Pro. No new-ladder perks are granted.
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

/** Queue order helper: higher rank first, then oldest first. */
export function compareQueue(
  a: { priorityRank: number; created_at: string },
  b: { priorityRank: number; created_at: string }
): number {
  if (a.priorityRank !== b.priorityRank) return b.priorityRank - a.priorityRank
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
}
