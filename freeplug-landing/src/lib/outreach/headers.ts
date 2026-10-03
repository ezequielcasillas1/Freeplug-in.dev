/**
 * Headers for every preview / claim response (Vera rule 5, Aria section 7). Also set for these
 * paths in next.config.ts headers(). The preview path is deliberately NOT in robots.txt Disallow
 * (Google must be able to fetch the page to see noindex) and never in the sitemap.
 */
export const PREVIEW_RESPONSE_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-store',
} as const

/** Path patterns (next.config.ts headers() syntax) that get PREVIEW_RESPONSE_HEADERS. */
export const PREVIEW_HEADER_SOURCES = ['/p/:path*', '/preview', '/preview/:path*', '/claim', '/claim/:path*'] as const

export const PREVIEW_ROBOTS_METADATA = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false, noarchive: true },
} as const
