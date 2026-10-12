// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import nextConfig from '../../../next.config'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { PREVIEW_HEADER_SOURCES, PREVIEW_RESPONSE_HEADERS, SITE_SECURITY_HEADER_SOURCE, SITE_SECURITY_HEADERS, withTerminalResponseHeaders } from './headers'

const enter = vi.fn(async (token: string) => token === 'good')
vi.mock('@/lib/outreach/server', () => ({ enterPreviewWithToken: (t: string) => enter(t) }))

describe('private preview headers', () => {
  it('next.config sends noindex, no-referrer and no-store on every preview and claim path', async () => {
    const all = await nextConfig.headers!()
    expect(all[0].source).toBe(SITE_SECURITY_HEADER_SOURCE)
    const rules = all.slice(1)
    expect(rules.map((r) => r.source)).toEqual([...PREVIEW_HEADER_SOURCES])
    for (const r of rules) {
      expect(Object.fromEntries(r.headers.map((h) => [h.key, h.value]))).toEqual(PREVIEW_RESPONSE_HEADERS)
    }
    expect(PREVIEW_RESPONSE_HEADERS['X-Robots-Tag']).toContain('noindex')
  })

  it('round 7 (Jace): the /claim layout (claim card, neutral page and its 404) carries robots noindex, and /claim + /claim/resend get X-Robots-Tag', async () => {
    const { metadata } = await import('@/app/claim/layout')
    expect(metadata.robots).toMatchObject({ index: false, follow: false })
    expect(PREVIEW_HEADER_SOURCES).toContain('/claim')
    expect(PREVIEW_HEADER_SOURCES).toContain('/claim/:path*')
  })

  it('robots.txt and the sitemap never mention the preview, claim or link paths', () => {
    const text = JSON.stringify([robots(), sitemap()])
    expect(text).not.toMatch(/\/preview|\/claim|\/p\//)
  })

  it('/p/<token> answers good and bad tokens the same way (303 to /preview, same headers)', async () => {
    const { GET } = await import('@/app/p/[token]/route')
    const answers = []
    for (const token of ['good', 'bad']) {
      const res = await GET(new Request(`http://localhost:3000/p/${token}`), { params: Promise.resolve({ token }) })
      answers.push({ status: res.status, location: res.headers.get('location'), robots: res.headers.get('x-robots-tag'), cache: res.headers.get('cache-control'), ref: res.headers.get('referrer-policy') })
    }
    expect(answers[0]).toEqual(answers[1])
    expect(answers[0]).toEqual({
      status: 303,
      location: 'http://localhost:3000/preview',
      robots: PREVIEW_RESPONSE_HEADERS['X-Robots-Tag'],
      cache: PREVIEW_RESPONSE_HEADERS['Cache-Control'],
      ref: 'no-referrer',
    })
  })

  it('Cloudflare port: the netlify.toml security headers are sent on every path, before the preview rules', async () => {
    const all = await nextConfig.headers!()
    expect(all[0]).toEqual({
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Content-Security-Policy-Report-Only', value: SITE_SECURITY_HEADERS['Content-Security-Policy-Report-Only'] },
      ],
    })
    const csp = SITE_SECURITY_HEADERS['Content-Security-Policy-Report-Only']
    for (const src of ['https://js.stripe.com', 'https://api.stripe.com', 'https://hooks.stripe.com', 'https://checkout.stripe.com', 'https://challenges.cloudflare.com']) {
      expect(csp).toContain(src)
    }
    expect(csp).toContain("default-src 'self'")
    // Same key in a later rule wins in Next, so preview paths keep no-referrer.
    const lastReferrer = all.filter((r) => r.headers.some((h) => h.key === 'Referrer-Policy')).at(-1)!
    expect(lastReferrer.headers.find((h) => h.key === 'Referrer-Policy')!.value).toBe('no-referrer')
  })

  it('public/_headers repeats the same security headers for static files, and netlify.toml is gone', () => {
    const root = path.join(__dirname, '../../..')
    const text = readFileSync(path.join(root, 'public/_headers'), 'utf8')
    const block = text.split(/\n\s*\n/).find((b) => /^\/\*$/m.test(b))!
    // Oct 12: HSTS + CSP-Report-Only are sent by Next/the Worker only (the CSP needs the build-time
    // Supabase URL); static files keep the original three.
    const STATIC_ONLY_SKIP = ['Strict-Transport-Security', 'Content-Security-Policy-Report-Only']
    for (const [k, v] of Object.entries(SITE_SECURITY_HEADERS)) if (!STATIC_ONLY_SKIP.includes(k)) expect(block).toContain(`  ${k}: ${v}`)
    expect(text).toMatch(/^\/_next\/static\/\*\n\s+Cache-Control: public, max-age=31536000, immutable$/m)
    expect(existsSync(path.join(root, '../netlify.toml'))).toBe(false)
    expect(existsSync(path.join(root, 'netlify.toml'))).toBe(false)
  })

  it('proxy.ts terminal responses (redirects, 413) get the security headers; pass-through responses are untouched', () => {
    const redirect = withTerminalResponseHeaders(new Response(null, { status: 307, headers: { location: '/login' } }), '/dashboard')
    expect(Object.fromEntries(Object.keys(SITE_SECURITY_HEADERS).map((k) => [k, redirect.headers.get(k)]))).toEqual(SITE_SECURITY_HEADERS)
    expect(redirect.headers.get('x-robots-tag')).toBeNull()
    const preview413 = withTerminalResponseHeaders(new Response('too large', { status: 413 }), '/preview')
    expect(preview413.headers.get('referrer-policy')).toBe('no-referrer')
    expect(preview413.headers.get('x-robots-tag')).toBe(PREVIEW_RESPONSE_HEADERS['X-Robots-Tag'])
    expect(preview413.headers.get('x-frame-options')).toBe('DENY')
    const next = withTerminalResponseHeaders(new Response(null, { headers: { 'x-middleware-next': '1' } }), '/preview')
    expect(next.headers.get('referrer-policy')).toBeNull()
    expect(next.headers.get('x-frame-options')).toBeNull()
  })
})
