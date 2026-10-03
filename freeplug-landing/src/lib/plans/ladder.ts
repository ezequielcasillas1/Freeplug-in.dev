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
  /** L2 AI-editor quota per month. Stored only: the L2 editor and enforcement are Part B. */
  aiEditsPerMonth: number
  /** 0 (Starter) .. 5 (Growth partner). Requests queue sorts by this, highest first. */
  rank: number
  /** Perks this step ADDS on top of the steps below it. */
  adds: readonly PlanPerk[]
}

const lookupKeyFor = (id: PlanStepId) => `freeplug_step_${id}_monthly`

export const PLAN_STEPS: readonly PlanStep[] = [
  { id: 'starter', name: 'Starter', monthlyCents: 3500, lookupKey: lookupKeyFor('starter'), aiEditsPerMonth: 5, rank: 0, adds: [] },
  { id: 'priority', name: 'Priority', monthlyCents: 5500, lookupKey: lookupKeyFor('priority'), aiEditsPerMonth: 15, rank: 1, adds: ['priorityQueue'] },
  { id: 'fast_lane', name: 'Fast lane', monthlyCents: 6500, lookupKey: lookupKeyFor('fast_lane'), aiEditsPerMonth: 15, rank: 2, adds: ['includedSmallEdit', 'nextBusinessDayEdits'] },
  { id: 'leads', name: 'Leads', monthlyCents: 7500, lookupKey: lookupKeyFor('leads'), aiEditsPerMonth: 40, rank: 3, adds: ['leadsReport', 'quoteAlerts'] },
  { id: 'get_found', name: 'Get found', monthlyCents: 8500, lookupKey: lookupKeyFor('get_found'), aiEditsPerMonth: 40, rank: 4, adds: ['gbpManaged', 'reviewKit'] },
  { id: 'growth', name: 'Growth partner', monthlyCents: 10000, lookupKey: lookupKeyFor('growth'), aiEditsPerMonth: 40, rank: 5, adds: ['seasonalRefresh', 'quarterlyCall', 'doneForYouEdits'] },
] as const

/**
 * "Done by the end of the next business day" (Fast lane and up): next Mon-Fri, by this hour,
 * Central time. No holidays yet. The promise itself still needs Ezequiel's yes (Aria Q2).
 */
export const SMALL_EDIT_DUE_HOUR_CT = 17
export const BUSINESS_TIME_ZONE = 'America/Chicago'

/** Included small edits per billing period at Fast lane and up (no rollover). */
export const INCLUDED_EDITS_PER_PERIOD = 1

/** Stripe product that holds all six step prices (one product so the Billing Portal can schedule
 * downgrades at period end; Stripe only does that between prices of the same product). */
export const LADDER_PRODUCT_ID = 'freeplug_hosting_ladder'

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
