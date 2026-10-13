import { PREVIEW_RESPONSE_HEADERS, SITE_SECURITY_HEADERS } from '@/lib/outreach/headers'

/**
 * Cloudflare port (Oct 3): headers the Worker adds to EVERY response it returns, so it matches
 * Netlify's old `[[headers]] for = "/*"` rule. OpenNext answers `/_next/image` and
 * `/cdn-cgi/image/*` itself, before the Next middleware and next.config.ts headers() run, so
 * those responses had none of them. Used by custom-worker.ts (wrangler.jsonc "main").
 *   * The site security headers are added only when missing, so a stricter value set by Next
 *     (Referrer-Policy: no-referrer on preview/claim pages) always wins.
 *   * Image-optimizer responses also get X-Robots-Tag noindex (Vera, Oct 3): they are only ever
 *     public marketing JPGs (remotePatterns is empty), but they should never be indexed.
 */
export const IMAGE_ENDPOINT_ROBOTS = PREVIEW_RESPONSE_HEADERS['X-Robots-Tag']

export function isImageOptimizerPath(pathname: string): boolean {
  return pathname === '/_next/image' || pathname === '/_next/image/' || pathname.startsWith('/cdn-cgi/image/')
}

export function withWorkerResponseHeaders(res: Response, pathname: string): Response {
  // Responses from fetch() / the assets binding can have immutable headers: copy first.
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(SITE_SECURITY_HEADERS)) {
    if (!out.headers.has(k)) out.headers.set(k, v)
  }
  if (isImageOptimizerPath(pathname)) out.headers.set('X-Robots-Tag', IMAGE_ENDPOINT_ROBOTS)
  return out
}
