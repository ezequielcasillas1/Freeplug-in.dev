import { describe, expect, it } from 'vitest'
import { isMaintenanceExempt, maintenanceLocale, maintenanceResponse, MAINTENANCE_MODE } from './maintenance'

describe('isMaintenanceExempt', () => {
  it.each([
    '/api/webhooks/stripe', '/api/webhooks/stripe/', '/unsubscribe', '/api/unsubscribe',
    '/admin', '/admin/requests', '/admin/change-requests/123', '/api/test-email', '/api/test-email/x',
    '/login', '/forgot-password', '/reset-password', '/link-expired', '/auth/callback', '/auth/confirm',
    '/_next/static/chunks/a.js', '/_next/image', '/favicon.ico', '/robots.txt', '/icon.svg',
  ])('exempts %s', (p) => expect(isMaintenanceExempt(p)).toBe(true))

  it.each([
    '/', '/es', '/faq', '/es/faq', '/signup', '/pricing', '/dashboard', '/claim', '/api/checkout/hosting',
    '/api/webhooks/stripe-fake', '/administrator', '/adminx', '/authx', '/login2', '/unsubscribe-all',
    '/api/webhooks', '/sitemap.xml', '/p/some-site',
  ])('blocks %s', (p) => expect(isMaintenanceExempt(p)).toBe(false))
})

describe('maintenanceLocale', () => {
  it('defaults to en', () => expect(maintenanceLocale('/', null, undefined)).toBe('en'))
  it('uses /es path', () => expect(maintenanceLocale('/es/faq', 'en-US', 'en')).toBe('es'))
  it('uses cookie', () => expect(maintenanceLocale('/', 'en-US', 'es')).toBe('es'))
  it('uses Accept-Language', () => expect(maintenanceLocale('/', 'es-MX,es;q=0.9', undefined)).toBe('es'))
})

describe('maintenanceResponse', () => {
  it('is on in this build', () => expect(MAINTENANCE_MODE).toBe(true))
  it('503 with Retry-After and noindex', async () => {
    const r = maintenanceResponse('es')
    expect(r.status).toBe(503)
    expect(r.headers.get('retry-after')).toBe('172800')
    const html = await r.text()
    expect(html).toContain('noindex')
    expect(html).toContain('Volvemos pronto')
  })
})
