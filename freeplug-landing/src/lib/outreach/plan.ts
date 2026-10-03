import { clampHostingCents, resolveAddonTier, type AddonTier } from '@/lib/stripe/config'

export type OutreachPlan = { hostingCents: number; addon: AddonTier | null; totalCents: number }

/**
 * Server-side plan from the stored choice. Always recomputed from ADDON_TIERS and the $35-$100
 * clamp (Aria, section 9); returns null for anything invalid.
 */
export function resolveOutreachPlan(
  hostingCents: unknown,
  addonTier: unknown
): OutreachPlan | null {
  const hosting = clampHostingCents(hostingCents)
  if (hosting === null) return null
  const addon = resolveAddonTier(addonTier)
  if (addon === undefined) return null
  return { hostingCents: hosting, addon, totalCents: hosting + (addon?.monthlyCents ?? 0) }
}

export function formatMonthly(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}/month`
}
