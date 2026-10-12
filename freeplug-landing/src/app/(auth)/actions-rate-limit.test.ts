// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Sign-in lockout (5 failures per email+IP / 15 min, failures only) and sign-up 5/IP/hour. */
const hits = new Map<string, number>()
const signInSpy = vi.fn()
const signUpSpy = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword: signInSpy, signUp: signUpSpy } }),
}))
vi.mock('@/lib/rate-limit', () => ({
  hashRateKey: (k: string) => k,
  rateCheck: async (rule: { bucket: string; limit: number }, key: string) => {
    const id = `${rule.bucket}:${key}`
    const n = hits.get(id) ?? 0
    if (n >= rule.limit) return false
    hits.set(id, n + 1)
    return true
  },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const f: Record<string, string> = {}
    const q = {
      select: () => q,
      eq: (c: string, v: string) => ((f[c] = v), q),
      gte: async () => ({ count: hits.get(`${f.bucket}:${f.key_hash}`) ?? 0, error: null }),
    }
    return { from: () => q }
  },
}))
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => ({}) }))

import { signIn, signUp } from './actions'

const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Please try again later.'

const blocked = '/login?error=' + encodeURIComponent(TOO_MANY_ATTEMPTS_MESSAGE)
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

describe('signIn lockout', () => {
  beforeEach(() => {
    hits.clear()
    signInSpy.mockReset()
    signInSpy.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
  })
  it('blocks the 6th attempt after 5 failures without calling Supabase', async () => {
    for (let i = 0; i < 5; i++) expect(await login()).not.toBe(blocked)
    expect(await login()).toBe(blocked)
    expect(signInSpy).toHaveBeenCalledTimes(5)
  })
  it('success still works after 4 failures and is not counted', async () => {
    for (let i = 0; i < 4; i++) await login()
    signInSpy.mockResolvedValue({ error: null })
    expect(await login()).toBe('/dashboard')
    expect(await login()).toBe('/dashboard')
  })
  it('keyed per email (case-insensitive)', async () => {
    for (let i = 0; i < 5; i++) await login('A@example.com')
    expect(await login('a@example.com')).toBe(blocked)
    expect(await login('b@example.com')).not.toBe(blocked)
  })
})

describe('signUp per-IP limit', () => {
  beforeEach(() => {
    hits.clear()
    signUpSpy.mockReset()
    signUpSpy.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null })
  })
  it('allows 5 per hour then shows the same blocked message', async () => {
    const f = () => form({ email: 'n@example.com', password: 'secret123', confirm: 'secret123' })
    for (let i = 0; i < 5; i++) expect(await url(signUp(f()))).toContain('/login?message=')
    expect(await url(signUp(f()))).toBe('/signup?error=' + encodeURIComponent(TOO_MANY_ATTEMPTS_MESSAGE))
    expect(signUpSpy).toHaveBeenCalledTimes(5)
  })
})
