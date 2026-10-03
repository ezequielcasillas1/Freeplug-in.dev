/**
 * The client IP used for per-IP rate limits (Vera QA #3, Sep 27). One helper for the whole app.
 *   * Netlify: `x-nf-client-connection-ip`, set by Netlify's edge from the real connection (a
 *     client-sent value is overwritten). Trusted ONLY when TRUST_NETLIFY_IP_HEADER=true (Vera r2
 *     N6, Jace round 5): anywhere else a client can send it. To be confirmed on a preview deploy.
 *   * `X-Forwarded-For` / `X-Real-IP` are client-controllable and are IGNORED unless
 *     TRUST_PROXY_HEADERS=true says a trusted proxy in front of the app sets them (then the
 *     first X-Forwarded-For entry, which that proxy wrote, is used).
 *     The flag is off by default (unset, or anything other than exactly "true").
 *   * Otherwise one fixed shared bucket, SHARED_IP_BUCKET: the limit still applies to everyone
 *     without a trusted IP, so faking X-Forwarded-For never gets around it.
 */
export const TRUST_PROXY_HEADERS_ENV = 'TRUST_PROXY_HEADERS'
export const TRUST_NETLIFY_IP_HEADER_ENV = 'TRUST_NETLIFY_IP_HEADER'
export const SHARED_IP_BUCKET = 'unknown-ip'

/** A real client IP (not the shared bucket). Vera r2 N6: callers used to compare with 'unknown'. */
export function isTrustedClientIp(ip: string | null | undefined): ip is string {
  return Boolean(ip) && ip !== SHARED_IP_BUCKET
}

type HeaderReader = { get(name: string): string | null }

export function clientIpFrom(h: HeaderReader, env: Record<string, string | undefined> = process.env): string {
  if (env[TRUST_NETLIFY_IP_HEADER_ENV] === 'true') {
    const netlify = h.get('x-nf-client-connection-ip')?.trim()
    if (netlify) return netlify
  }
  if (env[TRUST_PROXY_HEADERS_ENV] === 'true') {
    const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    const real = h.get('x-real-ip')?.trim()
    if (forwarded) return forwarded
    if (real) return real
  }
  return SHARED_IP_BUCKET
}
