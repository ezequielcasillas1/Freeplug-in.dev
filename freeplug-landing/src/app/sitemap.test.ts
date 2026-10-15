import { describe, expect, it } from 'vitest'
import robots from './robots'
import sitemap from './sitemap'

describe('sitemap and robots', () => {
  it('lists only the public pages on the real domain', () => {
    expect(sitemap().map((e) => e.url)).toEqual([
      'https://freeplug-in.dev/',
      'https://freeplug-in.dev/faq',
      'https://freeplug-in.dev/signup',
    ])
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
