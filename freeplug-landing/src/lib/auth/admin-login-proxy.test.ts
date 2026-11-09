import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { adminLoginProxyResponse, esLoginRedirect } from './admin-login-proxy'

const SLUG = 'k'.repeat(40)
afterEach(() => vi.unstubAllEnvs())
const req = (p: string) => new NextRequest(`http://localhost${p}`)

describe('admin login proxy', () => {
  it('rewrites /<ADMIN_LOGIN_PATH> to the internal route with noindex', () => {
    vi.stubEnv('ADMIN_LOGIN_PATH', SLUG)
    const res = adminLoginProxyResponse(req(`/${SLUG}`))!
    expect(res.headers.get('x-middleware-rewrite')).toContain('/internal-admin-login')
    expect(res.headers.get('x-robots-tag')).toContain('noindex')
  })
  it('404s the internal route directly, with or without a slug configured', () => {
    vi.stubEnv('ADMIN_LOGIN_PATH', SLUG)
    expect(adminLoginProxyResponse(req('/internal-admin-login'))!.status).toBe(404)
    vi.stubEnv('ADMIN_LOGIN_PATH', '')
    expect(adminLoginProxyResponse(req('/internal-admin-login'))!.status).toBe(404)
  })
  it('does nothing for other paths, a wrong slug, or no slug', () => {
    vi.stubEnv('ADMIN_LOGIN_PATH', SLUG)
    expect(adminLoginProxyResponse(req('/login'))).toBeNull()
    expect(adminLoginProxyResponse(req('/' + 'k'.repeat(39)))).toBeNull()
    vi.stubEnv('ADMIN_LOGIN_PATH', '')
    expect(adminLoginProxyResponse(req('/' + SLUG))).toBeNull()
  })
})

describe('/es/login', () => {
  it('redirects to /login?lang=es; other paths untouched', () => {
    const res = esLoginRedirect(req('/es/login?next=%2Fclaim'))!
    const loc = new URL(res.headers.get('location')!)
    expect(loc.pathname).toBe('/login')
    expect(loc.searchParams.get('lang')).toBe('es')
    expect(loc.searchParams.get('next')).toBe('/claim')
    expect(esLoginRedirect(req('/es/signup'))).toBeNull()
  })
})
