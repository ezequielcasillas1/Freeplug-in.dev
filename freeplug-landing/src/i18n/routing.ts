import { defineRouting } from 'next-intl/routing'
import { DEFAULT_LOCALE, LOCALE_COOKIE } from './config'
import { enabledLocales } from './gate'

/**
 * Public, indexable pages only (card R3). English stays unprefixed; Spanish lives under /es with
 * the same slugs. App pages (/dashboard, /login, /claim, auth, admin) are NOT here: they stay
 * unprefixed and read the locale from profiles.locale, then the NEXT_LOCALE cookie.
 *
 * - localeDetection: false -> no automatic redirect from the browser language (card R4).
 * - localeCookie: false -> the middleware never writes NEXT_LOCALE; only the switcher/banner do.
 * - alternateLinks: false -> hreflang comes from page metadata + the sitemap (gated), not headers.
 */
export const routing = defineRouting({
  locales: enabledLocales(),
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: false,
  alternateLinks: false,
})

export { LOCALE_COOKIE }

/** Unprefixed public paths that have a Spanish twin under /es. */
export const LOCALIZED_PUBLIC_PATHS = ['/', '/faq', '/signup', '/request-website'] as const
export type LocalizedPublicPath = (typeof LOCALIZED_PUBLIC_PATHS)[number]

/** Strips a leading /es or /en locale prefix: '/es/faq' -> '/faq', '/es' -> '/'. */
export function stripLocalePrefix(pathname: string): { locale: 'en' | 'es' | null; path: string } {
  const m = /^\/(en|es)(\/.*)?$/.exec(pathname)
  if (!m) return { locale: null, path: pathname }
  return { locale: m[1] as 'en' | 'es', path: m[2] && m[2] !== '/' ? m[2].replace(/\/+$/, '') || '/' : '/' }
}

/** True when the proxy should hand this path to next-intl (rewrite '/x' -> '/en/x', '/es/x' as is). */
export function isLocalizedPublicPath(pathname: string): boolean {
  const { locale, path } = stripLocalePrefix(pathname)
  if (locale === 'es' && !enabledLocales().includes('es')) return false
  return (LOCALIZED_PUBLIC_PATHS as readonly string[]).includes(path)
}

/** The same page in another locale: ('/es/faq', 'en') -> '/faq'; ('/faq', 'es') -> '/es/faq'. */
export function localizedPath(pathname: string, target: 'en' | 'es'): string {
  const { path } = stripLocalePrefix(pathname)
  if (target === 'en') return path
  return path === '/' ? '/es' : `/es${path}`
}

/**
 * A public href ('/#outreach', '/faq', '/signup?x=1') for a page locale. Only localized public
 * paths get the /es prefix; app paths ('/login', '/dashboard') come back unchanged.
 */
export function publicHref(href: string, locale: 'en' | 'es'): string {
  if (locale === 'en') return href
  const m = /^([^?#]*)([?#].*)?$/.exec(href)
  const path = m?.[1] || '/'
  const rest = m?.[2] ?? ''
  if (!(LOCALIZED_PUBLIC_PATHS as readonly string[]).includes(path)) return href
  return localizedPath(path, locale) + rest
}

/**
 * Header next-intl puts on its own rewrite ('/' -> '/en', '/faq' -> '/en/faq'). Next re-runs the proxy
 * on the rewritten '/en/...' path; handing that second pass to next-intl again makes it redirect the
 * "/en" prefix back to the unprefixed URL, so '/' answered 307 -> '/' forever (Oct 13 fix).
 */
export const INTL_LOCALE_HEADER = 'x-next-intl-locale'

/**
 * True when next-intl should handle this proxy pass: a localized public path, and not the internal
 * second pass of next-intl's own rewrite (a locale-prefixed path that already carries its header).
 * A browser visiting /en/... has no such header, so it still gets redirected to the unprefixed URL.
 */
export function shouldRunIntlRouting(pathname: string, headers: Pick<Headers, 'has'>): boolean {
  if (!isLocalizedPublicPath(pathname)) return false
  const { locale } = stripLocalePrefix(pathname)
  return !(locale !== null && headers.has(INTL_LOCALE_HEADER))
}
