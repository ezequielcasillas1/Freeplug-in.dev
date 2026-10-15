import { isIP } from 'node:net'

/**
 * The client IP used for per-IP rate limits (Vera QA #3, Sep 27). One helper for the whole app.
 * Cloudflare port (Oct 3, Aria A5, Jace constraint 1):
 *   * `CF-Connecting-IP` is set by Cloudflare's edge from the real connection. It is trusted ONLY
 *     when TRUST_CF_CONNECTING_IP is exactly "true" (set as a Worker var on production and
 *     preview only). Anywhere else a client can send that header, so it is ignored.
 *   * The value must be a valid IPv4 or IPv6 literal (node:net isIP, supported on Workers;
 *     IPv6 zone ids refused);
 *     anything else (missing, blank, a list, garbage) is not trusted.
 *   * There is deliberately no other source: X-Forwarded-For / X-Real-IP / Netlify's
 *     x-nf-client-connection-ip are never read (inside a Worker XFF isn't even set yet).
 *   * Otherwise one fixed shared bucket, SHARED_IP_BUCKET: the limit still applies to everyone
 *     without a trusted IP, so faking a header never gets around it.
 * Zone settings: keep "Pseudo IPv4" off and don't enable "Remove visitor IP headers".
 */
export const TRUST_CF_CONNECTING_IP_ENV = 'TRUST_CF_CONNECTING_IP'
export const SHARED_IP_BUCKET = 'unknown-ip'

/** A real client IP (not the shared bucket). Vera r2 N6: callers used to compare with 'unknown'. */
export function isTrustedClientIp(ip: string | null | undefined): ip is string {
  return Boolean(ip) && ip !== SHARED_IP_BUCKET
}

type HeaderReader = { get(name: string): string | null }

export function clientIpFrom(h: HeaderReader, env: Record<string, string | undefined> = process.env): string {
  if (env[TRUST_CF_CONNECTING_IP_ENV] !== 'true') return SHARED_IP_BUCKET
  const ip = h.get('cf-connecting-ip')?.trim()
  // No zone ids (fe80::1%eth0): node:net accepts them, but a remote client never has one.
  if (ip && !ip.includes('%') && isIP(ip) !== 0) return ip
  return SHARED_IP_BUCKET
}
