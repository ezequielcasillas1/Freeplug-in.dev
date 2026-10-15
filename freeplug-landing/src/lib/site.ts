/** Public site constants shared by pages and emails. */

/** Real public domain. Used when NEXT_PUBLIC_APP_URL is not set. */
export const SITE_URL_FALLBACK = 'https://freeplug-in.dev'

export const SUPPORT_EMAIL = 'support@freeplug-in.dev'
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`

/** Freeplug call / text number (Ezequiel, Sep 26, 2026). Change it here only. */
export const SUPPORT_PHONE_E164 = '+17373925612'
export const SUPPORT_PHONE_DISPLAY = '737-392-5612'
export const SUPPORT_TEL_HREF = `tel:${SUPPORT_PHONE_E164}`
export const SUPPORT_SMS_HREF = `sms:${SUPPORT_PHONE_E164}`

/**
 * Base URL for links in emails, without a trailing slash: an explicit value if given, else
 * NEXT_PUBLIC_APP_URL, else the public site.
 */
export function emailBaseUrl(explicit?: string): string {
  const raw = explicit?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || SITE_URL_FALLBACK
  return raw.replace(/\/+$/, '')
}

const LOCAL_DEV_HOST = /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/i

/**
 * Base URL for links/redirects that must come back to the server the user is actually on.
 * Only when running `next dev` (NODE_ENV === 'development') AND the request Host is localhost or
 * 127.0.0.1 (any port) is the request's own origin used, so a reset requested on
 * http://localhost:3000 links back there. Everywhere else the Host header is ignored (never trust
 * it in production) and `fallback` is used (default: emailBaseUrl(), i.e. NEXT_PUBLIC_APP_URL or
 * https://freeplug-in.dev).
 */
export function requestAwareBaseUrl(
  req: { host?: string | null; forwardedProto?: string | null },
  opts: { nodeEnv?: string; fallback?: string } = {}
): string {
  const nodeEnv = 'nodeEnv' in opts ? opts.nodeEnv : process.env.NODE_ENV
  const host = req.host?.trim() ?? ''
  if (nodeEnv === 'development' && LOCAL_DEV_HOST.test(host)) {
    const proto = req.forwardedProto?.split(',')[0]?.trim().toLowerCase() === 'https' ? 'https' : 'http'
    return `${proto}://${host.toLowerCase()}`
  }
  return (opts.fallback ?? emailBaseUrl()).replace(/\/+$/, '')
}
