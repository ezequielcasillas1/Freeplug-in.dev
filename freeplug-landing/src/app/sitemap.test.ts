import { describe, expect, it } from 'vitest'
import robots from './robots'
import sitemap, { buildSitemap } from './sitemap'

describe('sitemap and robots', () => {
  it('lists only the public pages on the real domain', () => {
    expect(sitemap().map((e) => e.url)).toEqual([
      'https://freeplug-in.dev/',
      'https://freeplug-in.dev/faq',
      'https://freeplug-in.dev/privacy',
      'https://freeplug-in.dev/compare',
    ])
  })

  it('gate on: both languages, each with en/es/x-default alternates (robots already allows /es)', () => {
    const s = buildSitemap('on')
    expect(s.map((e) => e.url)).toEqual([
      'https://freeplug-in.dev/',
      'https://freeplug-in.dev/es',
      'https://freeplug-in.dev/faq',
      'https://freeplug-in.dev/es/faq',
      'https://freeplug-in.dev/privacy',
      'https://freeplug-in.dev/es/privacy',
      'https://freeplug-in.dev/compare',
      'https://freeplug-in.dev/es/compare',
    ])
    expect(s[3].alternates?.languages).toEqual({
      en: 'https://freeplug-in.dev/faq',
      es: 'https://freeplug-in.dev/es/faq',
      'x-default': 'https://freeplug-in.dev/faq',
    })
    expect(s[7]).toMatchObject({ lastModified: '2026-10-31', alternates: { languages: { en: 'https://freeplug-in.dev/compare', es: 'https://freeplug-in.dev/es/compare', 'x-default': 'https://freeplug-in.dev/compare' } } })
    expect(buildSitemap('off')).toEqual(sitemap())
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
