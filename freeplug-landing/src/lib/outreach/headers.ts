/**
 * Headers for every preview / claim response (Vera rule 5, Aria section 7). Also set for these
 * paths in next.config.ts headers(). The preview path is deliberately NOT in robots.txt Disallow
 * (Google must be able to fetch the page to see noindex) and never in the sitemap.
 */
/**
 * Site-wide security headers (moved from netlify.toml `[[headers]] for = "/*"` in the Cloudflare
 * port, Oct 3; same three values). next.config.ts sends them on every path BEFORE the preview
 * rules, so the preview pages' Referrer-Policy: no-referrer still wins. public/_headers repeats
 * them for static files that Cloudflare serves without running the Worker; headers.test.ts keeps
 * the two in sync.
 */
/**
 * Supabase project origin + its realtime wss origin, from NEXT_PUBLIC_SUPABASE_URL (inlined at build).
 * Empty when unset or unparsable.
 */
export function supabaseCspSources(raw: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string[] {
  try {
    const u = new URL(raw ?? '')
    return [u.origin, `${u.protocol === 'http:' ? 'ws:' : 'wss:'}//${u.host}`]
  } catch {
    return []
  }
}

/**
 * Aria nit: a CSP without the Supabase origin would block auth and data calls once enforced, so a
 * production build (next.config.ts) fails when NEXT_PUBLIC_SUPABASE_URL is missing or not a URL.
 */
export function assertCspSupabaseUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): void {
  if (supabaseCspSources(raw).length === 0) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing or not a URL; the Content-Security-Policy needs it')
  }
}

/** CSP violation reports go here (src/app/api/csp-report/route.ts: logs only, size-capped, rate limited). */
export const CSP_REPORT_PATH = '/api/csp-report'

/**
 * Report-only for now (Oct 12): only 'self', Stripe (js/api/hooks/checkout), the Supabase project
 * (https + wss) and Cloudflare Turnstile (challenges.cloudflare.com).
 */
function contentSecurityPolicyReportOnly(): string {
  const supabase = supabaseCspSources()
  const stripeFrames = ['https://js.stripe.com', 'https://hooks.stripe.com', 'https://checkout.stripe.com']
  return [
    "default-src 'self'",
    "script-src 'self' https://js.stripe.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    ['img-src', "'self'", 'data:', 'blob:', ...supabase.slice(0, 1)].join(' '),
    "font-src 'self'",
    ['connect-src', "'self'", 'https://api.stripe.com', ...supabase].join(' '),
    ['frame-src', ...stripeFrames, 'https://challenges.cloudflare.com'].join(' '),
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
  ].join('; ')
}

export const SITE_SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=86400',
  'Content-Security-Policy-Report-Only': contentSecurityPolicyReportOnly(),
} as const

/** next.config.ts headers() source that matches every path, including "/". */
export const SITE_SECURITY_HEADER_SOURCE = '/:path*'

export const PREVIEW_RESPONSE_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-store',
} as const

/** Path patterns (next.config.ts headers() syntax) that get PREVIEW_RESPONSE_HEADERS. */
export const PREVIEW_HEADER_SOURCES = ['/p/:path*', '/preview', '/preview/:path*', '/claim', '/claim/:path*'] as const

export const PREVIEW_ROBOTS_METADATA = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false, noarchive: true },
} as const

/** Path prefixes covered by PREVIEW_HEADER_SOURCES (for responses built in proxy.ts). */
function isPreviewPath(pathname: string): boolean {
  return /^\/(p\/|preview(\/|$)|claim(\/|$))/.test(pathname)
}

/**
 * Cloudflare port (Oct 3): on OpenNext, responses that proxy.ts returns itself (the auth
 * redirects, the 413 for oversized uploads) don't get next.config.ts headers(), unlike
 * `next start` and Netlify's "/*" rule. proxy.ts passes those terminal responses through here.
 * Pass-through responses (NextResponse.next / rewrite) are left alone, so next.config.ts keeps
 * deciding their headers (and preview pages keep Referrer-Policy: no-referrer).
 */
export function withTerminalResponseHeaders<T extends Response>(res: T, pathname: string): T {
  if (res.headers.has('x-middleware-next') || res.headers.has('x-middleware-rewrite')) return res
  const extra: Record<string, string> = isPreviewPath(pathname)
    ? { ...SITE_SECURITY_HEADERS, ...PREVIEW_RESPONSE_HEADERS }
    : { ...SITE_SECURITY_HEADERS }
  for (const [k, v] of Object.entries(extra)) {
    if (!res.headers.has(k) || isPreviewPath(pathname)) res.headers.set(k, v)
  }
  return res
}
