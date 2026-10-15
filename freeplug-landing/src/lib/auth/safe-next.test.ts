// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CONFIRM_NEXT_ALLOWLIST, CONFIRM_OTP_TYPES, confirmNext, confirmOtpType, safeNext } from './safe-next'

describe('safeNext (login, /auth/callback, /auth/confirm)', () => {
  it.each(['/dashboard', '/dashboard/request-website', '/dashboard/cancel', '/claim', '/reset-password', '/admin/requests', '/dashboard?tab=billing', '/'])(
    'keeps the app path %j',
    (p) => expect(safeNext(p)).toBe(p)
  )
  it.each([
    null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', '\\evil.example', '/%2F/evil.example',
    '/%5Cevil.example', '/%252F%252Fevil.example', '/%2525252F%2525252Fevil.example', '/\t/evil.example', '/%0d%0a/x',
    'javascript:alert(1)', '/a?u=https://evil.example', '/%E0%A4%A', '/' + 'a'.repeat(600),
  ])('refuses %j', (p) => expect(safeNext(p as string)).toBe('/dashboard'))
  it.each([
    '/..//evil.com', '/.%2e/%2fevil.com', '/..', '/a/../b', '/%2e%2e/x', '/%2E%2E/x', '/a%2fb', '/a%2Fb', '/a%5cb', '/a%5Cb',
    '/%252e%252e/x', '/\\evil.com', '/%5C%5Cevil.com', '//%2fevil.com', '/%2f%2fevil.com', '/x\u0000', '/x\u001f', '/x\u007f',
    '/%00', '/%1F', '/%7f', 'data:text/html,x', '/javascript:alert(1)', 'http:/evil.com', '/http://evil.com', '/%68ttp://evil.com',
    'evil.com', '?next=/x', '#x', ' /dashboard', '/dashboard ', '/%20//evil.com', '/a%25', '/%2f', '///evil.com',
  ])('allowlist refuses %j', (p) => expect(safeNext(p)).toBe('/dashboard'))
  it('decodes once: a plain encoded letter is fine, the decoded value is still checked', () => {
    expect(safeNext('/d%61shboard')).toBe('/d%61shboard')
    expect(safeNext('/claim?token=abc-DEF_123')).toBe('/claim?token=abc-DEF_123')
  })
  it('uses the given fallback', () => expect(safeNext('//x', '/login')).toBe('/login'))
})

describe('confirm allowlists', () => {
  it('types are exactly the ones our links use', () => {
    expect([...CONFIRM_OTP_TYPES]).toEqual(['recovery', 'email', 'invite', 'email_change'])
    expect(confirmOtpType('signup')).toBeNull()
    expect(confirmOtpType('magiclink')).toBeNull()
    expect(confirmOtpType(null)).toBeNull()
  })
  it('next is an exact allowlisted path per type, else the type default', () => {
    expect(CONFIRM_NEXT_ALLOWLIST.recovery).toEqual(['/reset-password'])
    expect(confirmNext('email', '/claim')).toBe('/claim')
    expect(confirmNext('email', '/claim/')).toBe('/dashboard')
    expect(confirmNext('invite', '/claim')).toBe('/dashboard')
    expect(confirmNext('recovery', null)).toBe('/reset-password')
  })
})
