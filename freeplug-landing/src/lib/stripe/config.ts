/** USD cents — server-validated for every checkout. */
export const HOSTING_MIN_CENTS = 3500
export const HOSTING_MAX_CENTS = 10000
export const HOSTING_DEFAULT_CENTS = 3500
export const MAINTENANCE_MIN_CENTS = 5000
export const MAINTENANCE_MAX_CENTS = 10000

/** Hosting add-on tiers. Each tier includes everything in the one before it. */
export type AddonTierId = 'basic' | 'plus' | 'pro'

export type AddonTier = {
  id: AddonTierId
  name: string
  monthlyCents: number
  includes: readonly string[]
}

export const ADDON_TIERS: readonly AddonTier[] = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyCents: 500,
    includes: ['Regular backups', 'Downtime alerts'],
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyCents: 1000,
    includes: ['Everything in Basic', 'One small edit per month (no rollover)'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyCents: 1500,
    includes: [
      'Everything in Plus',
      'Google Business Profile kept current: hours, photos, one post a month',
    ],
  },
]

/**
 * Server-side add-on lookup. Returns the tier, null for "no add-on",
 * or undefined when the value is not a known tier.
 */
export function resolveAddonTier(value: unknown): AddonTier | null | undefined {
  if (value === undefined || value === null || value === '' || value === 'none') {
    return null
  }
  return ADDON_TIERS.find((t) => t.id === value)
}

export function clampHostingCents(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (n < HOSTING_MIN_CENTS || n > HOSTING_MAX_CENTS) return null
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
