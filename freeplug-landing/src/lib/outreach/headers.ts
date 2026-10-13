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
export const SITE_SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
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
