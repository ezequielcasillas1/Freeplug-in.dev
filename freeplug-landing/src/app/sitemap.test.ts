import { describe, expect, it } from 'vitest'
import robots from './robots'
import sitemap, { buildSitemap, SITEMAP_PATHS } from './sitemap'

const SITE = 'https://freeplug-in.dev'

describe('sitemap and robots', () => {
  it('lists only the public pages on the real domain', () => {
    expect(buildSitemap('off').map((e) => e.url)).toEqual(
      SITEMAP_PATHS.map((path) => (path === '/' ? `${SITE}/` : `${SITE}${path}`))
    )
    expect(SITEMAP_PATHS.filter((p) => p.startsWith('/merch/t-shirts/') && p !== '/merch/t-shirts')).toHaveLength(42)
    expect(SITEMAP_PATHS.filter((p) => p.startsWith('/shop'))).toHaveLength(196)
  })

  it('gate on: both languages, each with en/es/x-default alternates (robots already allows /es)', () => {
    const s = buildSitemap('on')
    expect(s.map((e) => e.url)).toEqual(
      SITEMAP_PATHS.flatMap((path) => [
        path === '/' ? `${SITE}/` : `${SITE}${path}`,
        path === '/' ? `${SITE}/es` : `${SITE}/es${path}`,
      ])
    )
    expect(s[3].alternates?.languages).toEqual({
      en: 'https://freeplug-in.dev/faq',
      es: 'https://freeplug-in.dev/es/faq',
      'x-default': 'https://freeplug-in.dev/faq',
    })
    expect(s[7]).toMatchObject({ lastModified: '2026-10-31', alternates: { languages: { en: 'https://freeplug-in.dev/compare', es: 'https://freeplug-in.dev/es/compare', 'x-default': 'https://freeplug-in.dev/compare' } } })
    expect(buildSitemap('off')).toEqual(buildSitemap('off'))
  })

  it('never lists signup or any login route (auth maintenance)', () => {
    const urls = buildSitemap('on').map((e) => e.url).join(' ')
    expect(urls).not.toMatch(/signup|login/)
  })

  it('keeps private areas out and points to the sitemap', () => {
    const r = robots()
    expect(r.rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/api', '/auth'],
    })
    expect(r.sitemap).toBe('https://freeplug-in.dev/sitemap.xml')
  })
})
