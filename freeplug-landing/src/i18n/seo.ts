import type { Metadata } from 'next'
import { SITE_URL_FALLBACK } from '@/lib/site'
import type { AppLocale } from './config'
import { spanishEnabled } from './gate'
import { localizedPath } from './routing'

/** Absolute public URL (always the real domain, like the sitemap). */
export function publicUrl(path: string): string {
  return path === '/' ? `${SITE_URL_FALLBACK}/` : `${SITE_URL_FALLBACK}${path}`
}

/**
 * Card R5: self-canonical per locale + hreflang en / es / x-default (-> English). Gate OFF returns
 * nothing, so English pages keep today's exact metadata and no hreflang is emitted (§6 case 12).
 */
export function publicAlternates(path: string, locale: AppLocale, raw?: string): Pick<Metadata, 'alternates'> {
  if (!spanishEnabled(raw)) return {}
  const en = localizedPath(path, 'en')
  const es = localizedPath(path, 'es')
  return {
    alternates: {
      canonical: publicUrl(locale === 'es' ? es : en),
      languages: { en: publicUrl(en), es: publicUrl(es), 'x-default': publicUrl(en) },
    },
  }
}

/** openGraph.locale per page locale (gate ON only). */
export function ogLocale(locale: AppLocale, raw?: string): { locale?: string } {
  if (!spanishEnabled(raw)) return {}
  return { locale: locale === 'es' ? 'es_US' : 'en_US' }
}
