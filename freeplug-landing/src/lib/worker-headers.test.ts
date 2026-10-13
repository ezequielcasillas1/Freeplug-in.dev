// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SITE_SECURITY_HEADERS } from '@/lib/outreach/headers'
import { isImageOptimizerPath, withWorkerResponseHeaders } from './worker-headers'

describe('Worker response headers (custom-worker.ts, Cloudflare port)', () => {
  it('/_next/image gets the three security headers and X-Robots-Tag noindex', () => {
    const res = withWorkerResponseHeaders(new Response('jpg', { headers: { 'content-type': 'image/jpeg' } }), '/_next/image')
    expect(Object.fromEntries(Object.keys(SITE_SECURITY_HEADERS).map((k) => [k, res.headers.get(k)]))).toEqual(SITE_SECURITY_HEADERS)
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(isImageOptimizerPath('/cdn-cgi/image/width=64/x.jpg')).toBe(true)
  })

  it('never overrides a stricter header Next already set (preview no-referrer) and adds no robots tag to pages', async () => {
    const res = withWorkerResponseHeaders(new Response('ok', { status: 404, headers: { 'Referrer-Policy': 'no-referrer' } }), '/preview')
    expect(res.status).toBe(404)
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(withWorkerResponseHeaders(new Response('ok'), '/').headers.get('x-robots-tag')).toBeNull()
    expect(await withWorkerResponseHeaders(new Response('body'), '/').text()).toBe('body')
  })

  it('works on immutable headers and keeps redirects', () => {
    const r = withWorkerResponseHeaders(Response.redirect('http://localhost/login', 307), '/dashboard')
    expect(r.status).toBe(307)
    expect(r.headers.get('location')).toBe('http://localhost/login')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('wrangler.jsonc runs custom-worker.ts, which wraps the OpenNext handler', () => {
    const root = path.join(__dirname, '../..')
    expect(readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')).toMatch(/^\s*"main": "custom-worker\.ts",$/m)
    const cw = readFileSync(path.join(root, 'custom-worker.ts'), 'utf8')
    expect(cw).toContain("from './.open-next/worker.js'")
    expect(cw).toContain('withWorkerResponseHeaders(')
  })
})

describe('next/image never spends the Images quota or touches private photos', () => {
  const src = path.join(__dirname, '..')
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? files(path.join(dir, d.name)) : /\.(tsx?|jsx?)$/.test(d.name) && !/\.test\./.test(d.name) ? [path.join(dir, d.name)] : []
    )

  it('every next/image <Image> is unoptimized (only OutreachSection uses it today)', () => {
    const users = files(src).filter((f) => /from ['"]next\/image['"]/.test(readFileSync(f, 'utf8')))
    expect(users.map((f) => path.relative(src, f))).toEqual(['features/landing/components/OutreachSection.tsx'])
    for (const f of users) {
      const tags = readFileSync(f, 'utf8').match(/<Image\b[\s\S]*?\/>/g) ?? []
      expect(tags.length).toBeGreaterThan(0)
      for (const t of tags) expect(t).toMatch(/\bunoptimized\b/)
    }
  })

  it('next.config has no images.remotePatterns or domains (remote / Supabase URLs are refused)', async () => {
    const cfg = (await import('../../next.config')).default
    expect(cfg.images?.remotePatterns).toBeUndefined()
    expect(cfg.images?.domains).toBeUndefined()
  })
})
