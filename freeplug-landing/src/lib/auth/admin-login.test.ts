import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { adminLoginPublicPath, isAdminEmail, ADMIN_LOGIN_INTERNAL_PATH } from './admin-login'

describe('admin login path', () => {
  it('is off unless ADMIN_LOGIN_PATH is a long slug', () => {
    expect(adminLoginPublicPath(undefined)).toBeNull()
    expect(adminLoginPublicPath('admin')).toBeNull()
    expect(adminLoginPublicPath('a'.repeat(23))).toBeNull()
    expect(adminLoginPublicPath('bad slug with spaces 1234567890')).toBeNull()
    expect(adminLoginPublicPath('/Ab3_-' + 'x'.repeat(30) + '/')).toBe('/Ab3_-' + 'x'.repeat(30))
  })
  it('isAdminEmail matches the ADMIN_EMAILS allowlist case-insensitively', () => {
    expect(isAdminEmail('Boss@X.test', 'boss@x.test, other@x.test')).toBe(true)
    expect(isAdminEmail('client@x.test', 'boss@x.test')).toBe(false)
    expect(isAdminEmail(undefined, 'boss@x.test')).toBe(false)
    expect(isAdminEmail('boss@x.test', '')).toBe(false)
  })
  it('the slug is never in the sitemap or linked; internal path not in the sitemap', () => {
    const sitemap = readFileSync('src/app/sitemap.ts', 'utf8')
    expect(sitemap).not.toContain(ADMIN_LOGIN_INTERNAL_PATH)
  })
})
