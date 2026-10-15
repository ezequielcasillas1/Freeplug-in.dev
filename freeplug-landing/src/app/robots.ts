import type { MetadataRoute } from 'next'
import { SITE_URL_FALLBACK } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/api', '/auth'],
    },
    sitemap: `${SITE_URL_FALLBACK}/sitemap.xml`,
  }
}
