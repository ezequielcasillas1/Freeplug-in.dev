/**
 * Maintenance mode ("back soon"), Oct 19 2026 (Cheke away until ~Oct 25/26).
 * When MAINTENANCE_MODE is on, the proxy answers every non-exempt path with a 503 page.
 * Turn off: set MAINTENANCE_MODE = false (or build with NEXT_PUBLIC_FREEPLUG_MAINTENANCE=off) and redeploy.
 */
export const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_FREEPLUG_MAINTENANCE !== 'off'

export const RETRY_AFTER_SECONDS = 172800

/** Exact paths that keep working. */
const EXEMPT_EXACT = new Set([
  '/favicon.ico',
  '/icon.svg',
  '/robots.txt',
  '/unsubscribe',
  '/api/unsubscribe',
  '/api/webhooks/stripe',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/link-expired',
])

/** Prefixes (segment boundary) that keep working. */
const EXEMPT_PREFIXES = ['/_next', '/admin', '/api/test-email', '/auth']

export function isMaintenanceExempt(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (EXEMPT_EXACT.has(p)) return true
  if (pathname === '/api/test-email' || pathname.startsWith('/api/test-email')) return true
  return EXEMPT_PREFIXES.some((pre) => p === pre || p.startsWith(pre + '/'))
}

export function maintenanceLocale(pathname: string, acceptLanguage: string | null, localeCookie: string | undefined): 'en' | 'es' {
  if (/^\/es(\/|$)/.test(pathname)) return 'es'
  if (/^\/en(\/|$)/.test(pathname)) return 'en'
  if (localeCookie === 'es') return 'es'
  if (localeCookie === 'en') return 'en'
  const first = (acceptLanguage ?? '').split(',')[0]?.trim().toLowerCase() ?? ''
  return first.startsWith('es') ? 'es' : 'en'
}

const COPY = {
  en: { title: 'Back soon · Freeplug', h: 'Back soon', body: "Freeplug is taking a short break. We'll be back soon. Thanks for your patience." },
  es: { title: 'Volvemos pronto · Freeplug', h: 'Volvemos pronto', body: 'Freeplug se está tomando un breve descanso. Volvemos pronto. Gracias por tu paciencia.' },
} as const

export function maintenanceHtml(locale: 'en' | 'es'): string {
  const c = COPY[locale]
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${c.title}</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fdf8f5;color:#2b2b2b;text-align:center;padding:24px}main{max-width:480px}.logo{font-weight:800;font-size:28px;color:#c2643a;letter-spacing:-.5px}h1{font-size:22px;margin:24px 0 8px}p{line-height:1.5;color:#555}.bar{width:48px;height:4px;background:#c2643a;border-radius:2px;margin:16px auto 0}</style></head><body><main><div class="logo">Freeplug</div><div class="bar"></div><h1>${c.h}</h1><p>${c.body}</p></main></body></html>`
}

export function maintenanceResponse(locale: 'en' | 'es'): Response {
  return new Response(maintenanceHtml(locale), {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'retry-after': String(RETRY_AFTER_SECONDS),
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
    },
  })
}
