// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Oct 24: private admin login + auth maintenance (public sign-in refused, non-admins signed out). */
const signInSpy = vi.fn()
const signOutSpy = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/auth/signups-paused', async (orig) => ({ ...(await orig<object>()), SIGNUPS_PAUSED: true, AUTH_MAINTENANCE: true }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  },
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'cf-connecting-ip': '203.0.113.9' }),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/background', () => ({ runAfterResponse: () => {} }))
vi.mock('@/lib/email/mailer', () => ({ isMailConfigured: () => false, sendMail: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword: signInSpy, signOut: signOutSpy } }),
}))
vi.mock('@/lib/rate-limit', () => ({
  hashRateKey: (k: string) => k,
  rateDecision: async () => 'allowed',
  rateCheck: async () => true,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.delete = () => q
    q.eq = () => q
    q.gte = async () => ({ count: 0, error: null })
    return { from: () => q }
  },
}))
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => ({}) }))

import { adminSignIn, signIn, signInWithGoogle } from './actions'

const SLUG = 'Z'.repeat(40)
const form = (email: string) => {
  const f = new FormData()
  f.set('email', email)
  f.set('password', 'pw-123456')
  return f
}
const go = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return (e as { url?: string }).url
  }
  return 'no-redirect'
}

beforeEach(() => {
  vi.stubEnv('ADMIN_LOGIN_PATH', SLUG)
  vi.stubEnv('ADMIN_EMAILS', 'boss@freeplug.test')
  signInSpy.mockReset()
  signOutSpy.mockClear()
})
afterEach(() => vi.unstubAllEnvs())

describe('auth maintenance: public login refused', () => {
  it('signIn / signInWithGoogle redirect to /login without calling Supabase', async () => {
    expect(await go(signIn(form('boss@freeplug.test')))).toBe('/login')
    expect(await go(signInWithGoogle())).toBe('/login')
    expect(signInSpy).not.toHaveBeenCalled()
  })
})

describe('adminSignIn', () => {
  it('admin (ADMIN_EMAILS) lands on /admin and keeps the session', async () => {
    signInSpy.mockResolvedValueOnce({ data: { user: { email: 'Boss@freeplug.test' } }, error: null })
    expect(await go(adminSignIn(form('Boss@freeplug.test')))).toBe('/admin')
    expect(signOutSpy).not.toHaveBeenCalled()
  })
  it('non-admin with a correct password is signed out and sent to the maintenance page', async () => {
    signInSpy.mockResolvedValueOnce({ data: { user: { email: 'client@freeplug.test' } }, error: null })
    expect(await go(adminSignIn(form('client@freeplug.test')))).toBe('/login')
    expect(signOutSpy).toHaveBeenCalledTimes(1)
  })
  it('a wrong password goes back to the secret slug with the generic error', async () => {
    signInSpy.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid login credentials' } })
    const url = await go(adminSignIn(form('boss@freeplug.test')))
    expect(url?.startsWith(`/${SLUG}?error=`)).toBe(true)
  })
  it('without ADMIN_LOGIN_PATH the action is off', async () => {
    vi.stubEnv('ADMIN_LOGIN_PATH', '')
    expect(await go(adminSignIn(form('boss@freeplug.test')))).toBe('/login')
    expect(signInSpy).not.toHaveBeenCalled()
  })
})
