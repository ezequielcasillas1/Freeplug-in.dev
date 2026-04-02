/** USD cents — server-validated for every checkout. */
export const HOSTING_MIN_CENTS = 2000
export const HOSTING_MAX_CENTS = 5000
export const HOSTING_DEFAULT_CENTS = 2000
export const ADDON_MONTHLY_CENTS = 500
export const MAINTENANCE_MIN_CENTS = 5000
export const MAINTENANCE_MAX_CENTS = 10000

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
