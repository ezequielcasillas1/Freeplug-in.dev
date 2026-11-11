import type { MetadataRoute } from 'next'
import { SITE_URL_FALLBACK } from '@/lib/site'
import { spanishEnabled } from '@/i18n/gate'
import { localizedPath } from '@/i18n/routing'
import { COMPARE_LASTMOD } from '@/lib/compare/data'
import { MERCH_COLLECTIONS, listPublicCollectionProducts } from '@/lib/merch/collections/catalog'
import { listPublicShirtProducts } from '@/lib/merch/shirts/catalog'
import { listShopItems } from '@/lib/merch/shop/catalog'

const COLLECTION_PATHS = MERCH_COLLECTIONS.flatMap((c) => [
  `/merch/${c}`,
  ...listPublicCollectionProducts(c).map((p) => `/merch/${c}/${p.slug}`),
])

const SHIRT_DETAIL_PATHS = listPublicShirtProducts().map((p) => `/merch/t-shirts/${p.slug}`)

const SHOP_PATHS = ['/shop', ...listShopItems().map((item) => `/shop/${item.slug}`)]

const SITEMAP_STATIC_CORE = [
  '/',
  '/faq',
  '/privacy',
  '/compare',
  '/merch',
  '/merch/all',
  '/merch/t-shirts',
  ...COLLECTION_PATHS,
  '/merch/freeplug-font-bundle',
  '/merch/fonts-personal-use',
] as const // /signup removed during auth maintenance (Oct 24)

/** Public, indexable pages only. Always the real public domain, never a dev/preview host. */
export const SITEMAP_PATHS = [...SITEMAP_STATIC_CORE, ...SHIRT_DETAIL_PATHS, ...SHOP_PATHS] as const

/** lastmod only where we know it (Oct 31: /compare). */
const lastmod = (path: string) => (path === '/compare' ? { lastModified: COMPARE_LASTMOD } : {})

const url = (path: string) => (path === '/' ? `${SITE_URL_FALLBACK}/` : `${SITE_URL_FALLBACK}${path}`)

/**
 * Gate OFF: exactly today's English list. Gate ON (card R5): every page in both languages, each
 * entry with its en / es / x-default alternates.
 */
export function buildSitemap(raw?: string): MetadataRoute.Sitemap {
  if (!spanishEnabled(raw)) return SITEMAP_PATHS.map((path) => ({ url: url(path), ...lastmod(path) }))
  const languages = (path: string) => ({ en: url(path), es: url(localizedPath(path, 'es')), 'x-default': url(path) })
  return SITEMAP_PATHS.flatMap((path) => [
    { url: url(path), ...lastmod(path), alternates: { languages: languages(path) } },
    { url: url(localizedPath(path, 'es')), ...lastmod(path), alternates: { languages: languages(path) } },
  ])
}

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap()
}
