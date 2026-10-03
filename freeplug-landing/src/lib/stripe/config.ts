import {
  LEGACY_ADDON_TIERS,
  legacyAddonById,
  resolvePlanStep,
  type LegacyAddonTierId,
} from '@/lib/plans/ladder'

/**
 * Hosting is sold as fixed steps (src/lib/plans/ladder.ts, the single source of tier values); new
 * checkouts use resolvePlanStep(). The range below is the HISTORICAL legacy slider range (matches the
 * outreach_sites CHECK 3500-10000). It is not a tier value: it is kept ONLY to read legacy slider
 * plans (clampHostingCents) and must not change when ladder prices change.
 */
export const LEGACY_HOSTING_MIN_CENTS = 3500
export const LEGACY_HOSTING_MAX_CENTS = 10000
export const MAINTENANCE_MIN_CENTS = 5000
export const MAINTENANCE_MAX_CENTS = 10000

export { resolvePlanStep, LEGACY_ADDON_TIERS }
export type { LegacyAddonTierId }

/** Legacy outreach product ids (fixed ids created on demand by the pre-ladder publish path). */
export const LEGACY_HOSTING_PRODUCT_ID = 'freeplug_hosting_monthly'
export const legacyAddonProductId = (tier: string) => `freeplug_addon_${tier}_monthly`

/**
 * Legacy add-on lookup (reading existing rows/subscriptions only; never offered). Returns the tier,
 * null for "no add-on", or undefined when the value is not a known tier.
 */
export function resolveLegacyAddonTier(value: unknown) {
  if (value === undefined || value === null || value === '' || value === 'none') {
    return null
  }
  return legacyAddonById(value) ?? undefined
}

/** Reads a legacy slider amount (rows saved before the ladder). Not used for new checkouts. */
export function clampHostingCents(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (n < LEGACY_HOSTING_MIN_CENTS || n > LEGACY_HOSTING_MAX_CENTS) return null
  return n
}

export function clampMaintenanceCents(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (n < MAINTENANCE_MIN_CENTS || n > MAINTENANCE_MAX_CENTS) return null
  return n
}

export function appBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) return 'http://localhost:3000'
  return url.replace(/\/$/, '')
}
