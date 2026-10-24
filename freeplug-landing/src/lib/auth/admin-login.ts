/**
 * Private admin login during auth maintenance (Cheke, Oct 24, 2026). The public slug comes from the
 * server-only ADMIN_LOGIN_PATH (a long random string, never committed). proxy.ts rewrites
 * /<ADMIN_LOGIN_PATH> to the internal route below and 404s any direct request to the internal route.
 */
export const ADMIN_LOGIN_INTERNAL_PATH = '/internal-admin-login'
const MIN_SLUG_LENGTH = 24

/** '/<slug>' when ADMIN_LOGIN_PATH is a usable slug (>= 24 chars of [A-Za-z0-9_-]), else null (route off). */
export function adminLoginPublicPath(raw: string | undefined = process.env.ADMIN_LOGIN_PATH): string | null {
  const slug = raw?.trim().replace(/^\/+|\/+$/g, '') ?? ''
  if (slug.length < MIN_SLUG_LENGTH || !/^[A-Za-z0-9_-]+$/.test(slug)) return null
  return `/${slug}`
}

export function adminEmailAllowlist(raw: string | undefined = process.env.ADMIN_EMAILS): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined, raw?: string): boolean {
  const e = email?.trim().toLowerCase()
  return Boolean(e) && adminEmailAllowlist(raw).includes(e as string)
}
