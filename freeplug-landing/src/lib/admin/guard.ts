import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function isLocalHost(host: string): boolean {
  const h = host.split(',')[0].trim().toLowerCase()
  return /^localhost(:\d+)?$/.test(h) || /^127\.0\.0\.1(:\d+)?$/.test(h)
}

function adminEmailAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Shared identity + host gates for /admin and admin-only APIs.
 * Returns false instead of throwing — callers map to notFound() or HTTP 404.
 */
export async function isAdminAccessAllowed(): Promise<boolean> {
  const prod = process.env.NODE_ENV === 'production'
  if (prod && process.env.ADMIN_ROUTE_ENABLED !== 'true') {
    return false
  }
  if (!prod) {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
    if (!isLocalHost(host)) {
      return false
    }
  }

  const allowlist = adminEmailAllowlist()
  if (allowlist.length === 0) {
    return false
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!user || !email || !allowlist.includes(email)) {
    return false
  }
  return true
}

/** Require signed-in allowlisted admin. Prod also needs ADMIN_ROUTE_ENABLED=true. */
export async function assertAdminAccess() {
  if (!(await isAdminAccessAllowed())) {
    notFound()
  }
}
