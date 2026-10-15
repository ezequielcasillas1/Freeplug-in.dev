import type { MetadataRoute } from 'next'
import { SITE_URL_FALLBACK } from '@/lib/site'

/** Public, indexable pages only. Always the real public domain, never a dev/preview host. */
export const SITEMAP_PATHS = ['/', '/faq', '/signup'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  return SITEMAP_PATHS.map((path) => ({
    url: path === '/' ? `${SITE_URL_FALLBACK}/` : `${SITE_URL_FALLBACK}${path}`,
  }))
}
