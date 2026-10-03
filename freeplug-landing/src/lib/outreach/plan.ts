import { resolvePlanStep, type PlanStep } from '@/lib/plans/ladder'
import { clampHostingCents, resolveLegacyAddonTier } from '@/lib/stripe/config'

/**
 * Server-side step from the stored choice (outreach_sites.plan_step). Always re-resolved from the
 * ladder (src/lib/plans/ladder.ts); returns null for anything unknown. The amount charged comes from
 * the Stripe price behind the step's lookup key, never from the row.
 */
export function resolveOutreachStep(planStep: unknown): PlanStep | null {
  return resolvePlanStep(planStep)
}

export type LegacyOutreachPlan = {
  hostingCents: number
  addon: { id: string; name: string; monthlyCents: number } | null
  totalCents: number
}

/**
 * Pre-ladder choice (plan_hosting_cents + plan_addon_tier) saved before Oct 3 2026. Read-only: it is
 * shown to admins so they can ask the customer to pick a step; it is never charged (no price_data).
 */
export function resolveLegacyOutreachPlan(hostingCents: unknown, addonTier: unknown): LegacyOutreachPlan | null {
  const hosting = clampHostingCents(hostingCents)
  if (hosting === null) return null
  const addon = resolveLegacyAddonTier(addonTier)
  if (addon === undefined) return null
  return { hostingCents: hosting, addon, totalCents: hosting + (addon?.monthlyCents ?? 0) }
}

export function formatMonthly(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/month`
}
