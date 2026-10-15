// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Round 6 (Aria): /auth/confirm type + next allowlists, open-redirect variants, neutral expired page. */
const verifyOtp = vi.fn()
const jarSet = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { verifyOtp } }) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ set: jarSet }) }))

import { GET } from './route'
import { RESET_COOKIE_NAME } from '@/lib/auth/reset-cookie'

const APP = 'https://freeplug-in.dev'

async function visit(params: Record<string, string> | string) {
  const qs = typeof params === 'string' ? params : new URLSearchParams(params).toString()
  const res = await GET(new Request(`${APP}/auth/confirm${qs ? `?${qs}` : ''}`))
  expect(res.status).toBe(307)
  const location = res.headers.get('location')!
  const u = new URL(location)
  expect(u.origin).toBe(APP) // never anywhere else
  return u.pathname + u.search
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', APP)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-not-a-real-key')
  verifyOtp.mockReset()
  verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' }, session: {} }, error: null })
  jarSet.mockReset()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('valid links: each allowed type', () => {
  it('recovery → /reset-password, with the 15-minute reset cookie', async () => {
    expect(await visit({ token_hash: 'th_1', type: 'recovery', next: '/reset-password' })).toBe('/reset-password')
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'th_1' })
    expect(jarSet).toHaveBeenCalledWith(RESET_COOKIE_NAME, expect.any(String), expect.any(Object))
  })
  it('recovery without next, or with another allowed path, still → /reset-password', async () => {
    expect(await visit({ token_hash: 'th_1', type: 'recovery' })).toBe('/reset-password')
    expect(await visit({ token_hash: 'th_1', type: 'recovery', next: '/dashboard' })).toBe('/reset-password')
  })
  it('email (sign-up confirmation / magic link) → /dashboard by default, /claim for the claim flow', async () => {
    expect(await visit({ token_hash: 'th_2', type: 'email', next: '/dashboard' })).toBe('/dashboard')
    expect(await visit({ token_hash: 'th_2', type: 'email' })).toBe('/dashboard')
    expect(await visit({ token_hash: 'th_2', type: 'email', next: '/claim' })).toBe('/claim')
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'email', token_hash: 'th_2' })
    expect(jarSet).not.toHaveBeenCalled() // only recovery gets the reset cookie
  })
  it('invite → /dashboard', async () => {
    expect(await visit({ token_hash: 'th_3', type: 'invite', next: '/dashboard' })).toBe('/dashboard')
    expect(await visit({ token_hash: 'th_3', type: 'invite', next: '/claim' })).toBe('/dashboard')
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'invite', token_hash: 'th_3' })
  })
  it('email_change → /dashboard', async () => {
    expect(await visit({ token_hash: 'th_4', type: 'email_change', next: '/dashboard' })).toBe('/dashboard')
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'email_change', token_hash: 'th_4' })
  })
})

describe('bad type: never verified, neutral page', () => {
  it.each(['signup', 'magiclink', 'sms', 'phone_change', 'RECOVERY', 'recovery ', ' email', 'recovery,email', 'email_change\u0000', '', 'token'])(
    'type=%j',
    async (type) => {
      expect(await visit({ token_hash: 'th', type, next: '/dashboard' })).toBe('/link-expired?for=account')
      expect(verifyOtp).not.toHaveBeenCalled()
    }
  )
  it('a bad type on a reset link still offers a new reset link', async () => {
    expect(await visit({ token_hash: 'th', type: 'signup', next: '/reset-password' })).toBe('/link-expired?for=reset')
  })
})

describe('open-redirect variants in next: always the type default, always this origin', () => {
  const VARIANTS = [
    'https://evil.example',
    'HTTPS://evil.example',
    'http:/evil.example',
    '//evil.example',
    '///evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    '/\\/evil.example',
    '%2F%2Fevil.example',
    '/%2F/evil.example',
    '/%2f%2fevil.example',
    '/%5Cevil.example',
    '/%5cevil.example',
    '/%252F%252Fevil.example',
    '/%25252F%25252Fevil.example',
    '/%2525252F%2525252Fevil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/%09/evil.example',
    '/%0a/evil.example',
    ' /dashboard',
    'javascript:alert(1)',
    '/javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'evil.example',
    '/dashboard?next=https://evil.example',
    '/dashboard#//evil.example',
    '/dashboard/../..//evil.example',
    '/dashboard/',
    '/Dashboard',
    '/claim?x=1',
    '/admin/requests',
    '/%E0%A4%A',
    '/' + 'a'.repeat(600),
  ]
  it.each(VARIANTS)('next=%j', async (next) => {
    expect(await visit({ token_hash: 'th', type: 'email', next })).toBe('/dashboard')
    expect(await visit({ token_hash: 'th', type: 'recovery', next })).toBe('/reset-password')
  })
})

describe('expired, used or incomplete links: one neutral page', () => {
  const EXPIRED = { code: 'otp_expired', status: 403, message: 'Email link is invalid or has expired' }
  it.each([
    ['expired', EXPIRED],
    ['already used', { ...EXPIRED }], // Supabase answers a used token with the same otp_expired error
    ['other verify error', { code: 'unexpected_failure', status: 500, message: 'x' }],
  ])('%s token', async (_label, error) => {
    verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error })
    expect(await visit({ token_hash: 'th_secret_value', type: 'recovery', next: '/reset-password' })).toBe('/link-expired?for=reset')
    expect(await visit({ token_hash: 'th_secret_value', type: 'email', next: '/claim' })).toBe('/link-expired?for=claim')
    expect(await visit({ token_hash: 'th_secret_value', type: 'email' })).toBe('/link-expired?for=account')
    expect(await visit({ token_hash: 'th_secret_value', type: 'email_change' })).toBe('/link-expired?for=account')
    expect(jarSet).not.toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('th_secret_value')
  })
  it.each([
    ['nothing', ''],
    ['no token_hash', 'type=recovery&next=%2Freset-password'],
    ['empty token_hash', 'token_hash=&type=email'],
    ['no type', 'token_hash=th'],
    ['empty type', 'token_hash=th&type='],
    ['only next', 'next=%2Fclaim'],
  ])('missing params: %s', async (_label, qs) => {
    const to = await visit(qs)
    expect(to).toMatch(/^\/link-expired\?for=(reset|claim|account)$/)
    expect(verifyOtp).not.toHaveBeenCalled()
  })
})
