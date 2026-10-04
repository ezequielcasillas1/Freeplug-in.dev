import type { MetadataRoute } from 'next'
import { SITE_URL_FALLBACK } from '@/lib/site'
import { spanishEnabled } from '@/i18n/gate'
import { localizedPath } from '@/i18n/routing'

/** Public, indexable pages only. Always the real public domain, never a dev/preview host. */
export const SITEMAP_PATHS = ['/', '/faq', '/signup'] as const

const url = (path: string) => (path === '/' ? `${SITE_URL_FALLBACK}/` : `${SITE_URL_FALLBACK}${path}`)

/**
 * Gate OFF: exactly today's English list. Gate ON (card R5): every page in both languages, each
 * entry with its en / es / x-default alternates.
 */
export function buildSitemap(raw?: string): MetadataRoute.Sitemap {
  if (!spanishEnabled(raw)) return SITEMAP_PATHS.map((path) => ({ url: url(path) }))
  const languages = (path: string) => ({ en: url(path), es: url(localizedPath(path, 'es')), 'x-default': url(path) })
  return SITEMAP_PATHS.flatMap((path) => [
    { url: url(path), alternates: { languages: languages(path) } },
    { url: url(localizedPath(path, 'es')), alternates: { languages: languages(path) } },
  ])
}

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap()
}
