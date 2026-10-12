// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Sign-in lockout (5 failures per email+IP / 15 min, failures only, cleared on success, fails open on a
 * limiter DB error) and sign-up 5/IP/hour (valid submissions only, blocks on a DB error).
 */
const hits = new Map<string, number>()
const db = { down: false }
let ip: string | null = null
const signInSpy = vi.fn()
const signUpSpy = vi.fn()
const mailSpy = vi.fn(async () => ({ success: true, id: 'm' }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  },
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(ip ? { 'cf-connecting-ip': ip } : {}),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/background', () => ({ runAfterResponse: (_n: string, fn: () => Promise<void>) => fn() }))
vi.mock('@/lib/email/mailer', () => ({ isMailConfigured: () => true, sendMail: (...a: unknown[]) => mailSpy(...(a as [])) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword: signInSpy, signUp: signUpSpy } }),
}))
vi.mock('@/lib/rate-limit', () => {
  const decide = async (rule: { bucket: string; limit: number }, key: string) => {
    if (db.down) return 'error'
    const id = `${rule.bucket}:${key}`
    const n = hits.get(id) ?? 0
    if (n >= rule.limit) return 'limited'
    hits.set(id, n + 1)
    return 'allowed'
  }
  return {
    hashRateKey: (k: string) => k,
    rateDecision: decide,
    rateCheck: async (rule: { bucket: string; limit: number }, key: string) => (await decide(rule, key)) === 'allowed',
  }
})
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const f: Record<string, string> = {}
    let del = false
    const q = {
      select: () => q,
      delete: () => ((del = true), q),
      eq: (c: string, v: string) => {
        f[c] = v
        if (del && c === 'key_hash') {
          hits.delete(`${f.bucket}:${v}`)
          return Promise.resolve({ error: null })
        }
        return q
      },
      gte: async () =>
        db.down ? { count: null, error: { message: 'down' } } : { count: hits.get(`${f.bucket}:${f.key_hash}`) ?? 0, error: null },
    }
    return { from: () => q }
  },
}))
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => ({}) }))

import { signIn, signUp } from './actions'

const TOO_MANY = 'Too many attempts. Please try again later.'
const blocked = '/login?error=' + encodeURIComponent(TOO_MANY)
function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}
async function url(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as { url: string }).url
  }
  throw new Error('no redirect')
}
const login = (email = 'a@example.com') => url(signIn(form({ email, password: 'pw' })))
const signupForm = (extra: Record<string, string> = {}) =>
  form({ email: 'n@example.com', password: 'secret123', confirm: 'secret123', ...extra })

beforeEach(() => {
  hits.clear()
  db.down = false
  ip = null
  vi.stubEnv('TRUST_CF_CONNECTING_IP', 'true')
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.test')
  signInSpy.mockReset()
  signInSpy.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
  signUpSpy.mockReset()
  signUpSpy.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null })
  mailSpy.mockClear()
})
afterEach(() => vi.unstubAllEnvs())

describe('signIn lockout', () => {
  it('blocks the 6th attempt after 5 failures without calling Supabase', async () => {
    for (let i = 0; i < 5; i++) expect(await login()).not.toBe(blocked)
    expect(await login()).toBe(blocked)
    expect(signInSpy).toHaveBeenCalledTimes(5)
  })
  it('a success after 4 failures works and resets the count', async () => {
    for (let i = 0; i < 4; i++) await login()
    signInSpy.mockResolvedValueOnce({ error: null })
    expect(await login()).toBe('/dashboard')
    for (let i = 0; i < 5; i++) expect(await login()).not.toBe(blocked)
    expect(await login()).toBe(blocked)
  })
  it('keyed per email (case-insensitive)', async () => {
    for (let i = 0; i < 5; i++) await login('A@example.com')
    expect(await login('a@example.com')).toBe(blocked)
    expect(await login('b@example.com')).not.toBe(blocked)
  })
  it('two IPs, same email: counted separately (per email+IP)', async () => {
    ip = '203.0.113.1'
    for (let i = 0; i < 5; i++) await login()
    expect(await login()).toBe(blocked)
    ip = '203.0.113.2'
    expect(await login()).not.toBe(blocked)
  })
  it('unknown-ip bucket: untrusted or missing IPs share one count per email', async () => {
    vi.stubEnv('TRUST_CF_CONNECTING_IP', '')
    ip = '203.0.113.1'
    for (let i = 0; i < 5; i++) await login()
    ip = '203.0.113.9' // ignored without TRUST_CF_CONNECTING_IP
    expect(await login()).toBe(blocked)
    expect([...hits.keys()].filter((k) => k.startsWith('signin_fail_email_ip:'))).toEqual(['signin_fail_email_ip:a@example.com|unknown-ip'])
  })
  it('limiter DB error: sign-in fails OPEN (allowed) and alerts admins', async () => {
    db.down = true
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    signInSpy.mockResolvedValueOnce({ error: null })
    expect(await login()).toBe('/dashboard')
    expect(signInSpy).toHaveBeenCalledTimes(1)
    expect(mailSpy).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(mailSpy.mock.calls[0])).not.toContain('a@example.com')
    quiet.mockRestore()
  })
})

describe('signUp per-IP limit', () => {
  it('allows 5 per hour then shows the same blocked message', async () => {
    for (let i = 0; i < 5; i++) expect(await url(signUp(signupForm()))).toContain('/login?message=')
    expect(await url(signUp(signupForm()))).toBe('/signup?error=' + encodeURIComponent(TOO_MANY))
    expect(signUpSpy).toHaveBeenCalledTimes(5)
  })
  it('invalid input does not count toward the cap', async () => {
    for (let i = 0; i < 10; i++) await url(signUp(signupForm({ confirm: 'nope12345' })))
    expect(hits.size).toBe(0)
    expect(await url(signUp(signupForm()))).toContain('/login?message=')
  })
  it('limiter DB error: sign-up is blocked with the try-again-in-a-minute message', async () => {
    db.down = true
    expect(await url(signUp(signupForm()))).toBe(
      '/signup?error=' + encodeURIComponent('Something went wrong on our end. Please try again in a minute.')
    )
    expect(signUpSpy).not.toHaveBeenCalled()
  })
})

describe('per-email cap across IPs (Aria a)', () => {
  it('20 failures from different IPs lock the email (same message), other emails unaffected, admin alerted', async () => {
    for (let i = 0; i < 20; i++) {
      ip = `203.0.113.${i + 1}`
      expect(await login()).not.toBe(blocked)
    }
    ip = '198.51.100.7'
    expect(await login()).toBe(blocked)
    expect(signInSpy).toHaveBeenCalledTimes(20)
    expect(mailSpy).toHaveBeenCalledTimes(1)
    expect(await login('other@example.com')).not.toBe(blocked)
  })
  it('a successful sign-in clears the per-email count', async () => {
    for (let i = 0; i < 19; i++) {
      ip = `203.0.113.${i + 1}`
      await login()
    }
    signInSpy.mockResolvedValueOnce({ error: null })
    expect(await login()).toBe('/dashboard')
    expect(hits.get('signin_fail_email:a@example.com')).toBeUndefined()
  })
})

describe('generic auth messages (no raw Supabase text, no account-existence hint)', () => {
  beforeEach(() => {
    hits.clear()
    signInSpy.mockReset()
    signUpSpy.mockReset()
  })
  it('wrong password and unknown email read identically', async () => {
    signInSpy.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
    const a = await login('known@example.com')
    signInSpy.mockResolvedValueOnce({ error: { message: 'Email not confirmed' } })
    const b = await login('unknown@example.com')
    expect(a).toBe('/login?error=' + encodeURIComponent('Email or password is incorrect.'))
    expect(b).toBe(a)
  })
  it('sign-up error and new-account success answer the same way', async () => {
    const f = () => form({ email: 'n@example.com', password: 'secret123', confirm: 'secret123' })
    signUpSpy.mockResolvedValueOnce({ data: { user: null, session: null }, error: { message: 'User already registered' } })
    const a = await url(signUp(f()))
    signUpSpy.mockResolvedValueOnce({ data: { user: { id: 'u' }, session: null }, error: null })
    const b = await url(signUp(f()))
    expect(a).toBe('/login?message=' + encodeURIComponent("If that email can be used, we've sent next steps. Check your inbox."))
    expect(b).toBe(a)
  })
})

describe('sign-up weak password (gap 3)', () => {
  it('Supabase weak_password shows the password message, not the check-your-inbox line', async () => {
    signUpSpy.mockResolvedValueOnce({ data: { user: null, session: null }, error: { code: 'weak_password', name: 'AuthWeakPasswordError', message: 'Password should contain at least one character of each: ...' } })
    expect(await url(signUp(signupForm()))).toBe(
      '/signup?error=' + encodeURIComponent('Your password needs at least 6 characters. Please try a stronger one.')
    )
  })
  it('too-short password keeps the existing form wording', async () => {
    expect(await url(signUp(signupForm({ password: 'abc', confirm: 'abc' })))).toBe(
      '/signup?error=' + encodeURIComponent('Password must be at least 6 characters.')
    )
  })
})
