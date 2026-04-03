import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

function isLocalHost(host: string): boolean {
  const h = host.split(',')[0].trim().toLowerCase()
  return /^localhost(:\d+)?$/.test(h) || /^127\.0\.0\.1(:\d+)?$/.test(h)
}

/** Localhost admin only in dev; production needs ADMIN_ROUTE_ENABLED=true. */
export async function assertAdminAccess() {
  const prod = process.env.NODE_ENV === 'production'
  if (prod && process.env.ADMIN_ROUTE_ENABLED !== 'true') {
    notFound()
  }
  if (!prod) {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
    if (!isLocalHost(host)) {
      notFound()
    }
  }
}
