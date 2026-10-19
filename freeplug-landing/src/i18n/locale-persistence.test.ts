/**
 * Persistence (Oct 10): saveLocalePreference writes profiles.locale (owner-only RPC) then the cookie;
 * sign-in rewrites the cookie from profiles.locale; pages resolve from the profile, so the choice
 * survives page changes, reload and sign-out/sign-in. A fake Supabase holds the rows.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FREEPLUG_I18N_ES = 'on'
})

const jar = new Map<string, string>()
const db = { profiles: new Map<string, { locale: string }>() }
let session: string | null = null

function fakeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: session ? { id: session } : null } }),
      updateUser: async () => ({ error: null }),
    },
    // Mirrors set_own_locale: writes only auth.uid()'s row, never takes a user id.
    rpc: async (fn: string, args: { p_locale: string; p_user_id?: string }) => {
      if (fn !== 'set_own_locale') throw new Error(fn)
      if (!session) return { error: { message: 'Sign in to save your language.' } }
      if (!['en', 'es'].includes(args.p_locale)) return { error: { message: 'Unsupported language.' } }
      db.profiles.get(session)!.locale = args.p_locale
      return { error: null }
    },
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: db.profiles.get(id) ?? null, error: null }) }),
      }),
    }),
  }
}

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
  }),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeClient() }))
vi.mock('@/lib/stripe/server', () => ({ getStripe: () => ({}) }))
vi.mock('@/lib/stripe/locale', () => ({ syncCustomerPreferredLocales: vi.fn() }))
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(f: T) => f }))

const { saveLocalePreference } = await import('@/app/language-actions')
const { syncLocaleCookieFromProfile } = await import('./locale-cookie-sync')
const { resolveAppLocale } = await import('./user-locale')

const signIn = async (id: string) => {
  session = id
  await syncLocaleCookieFromProfile(fakeClient() as never, id)
}
const signOut = () => {
  session = null
}
const cookieMatchesProfile = () => jar.get('NEXT_LOCALE') === db.profiles.get(session!)?.locale

beforeEach(() => {
  jar.clear()
  db.profiles = new Map([['alice', { locale: 'en' }], ['bob', { locale: 'en' }]])
  session = null
})

describe('dashboard language persistence', () => {
  it('EN -> ES -> EN, cookie = profiles.locale each time', async () => {
    await signIn('alice')
    expect(await resolveAppLocale()).toBe('en')
    expect(await saveLocalePreference('es')).toMatchObject({ ok: true, savedToAccount: true })
    expect(db.profiles.get('alice')!.locale).toBe('es')
    expect(cookieMatchesProfile()).toBe(true)
    expect(await resolveAppLocale()).toBe('es')
    await saveLocalePreference('en')
    expect(db.profiles.get('alice')!.locale).toBe('en')
    expect(cookieMatchesProfile()).toBe(true)
    expect(await resolveAppLocale()).toBe('en')
  })
  it('stays set across pages and reload (every request resolves es from the profile)', async () => {
    await signIn('alice')
    await saveLocalePreference('es')
    for (let i = 0; i < 4; i++) expect(await resolveAppLocale()).toBe('es')
    jar.delete('NEXT_LOCALE') // even a lost cookie: the profile still wins while signed in
    expect(await resolveAppLocale()).toBe('es')
  })
  it('survives sign-out/sign-in, and sign-in rewrites a stale cookie to profiles.locale', async () => {
    await signIn('alice')
    await saveLocalePreference('es')
    signOut()
    jar.set('NEXT_LOCALE', 'en') // someone flipped it while signed out
    await signIn('alice')
    expect(jar.get('NEXT_LOCALE')).toBe('es')
    expect(cookieMatchesProfile()).toBe(true)
    expect(await resolveAppLocale()).toBe('es')
  })
  it('a failed account save leaves the cookie untouched (they never disagree)', async () => {
    await signIn('alice')
    jar.set('NEXT_LOCALE', 'en')
    db.profiles.delete('alice')
    db.profiles.set('alice', { locale: 'en' })
    const c = fakeClient()
    c.rpc = async () => ({ error: { message: 'boom' } })
    const mod = await import('@/lib/supabase/server')
    vi.spyOn(mod, 'createClient').mockResolvedValueOnce(c as never)
    expect(await saveLocalePreference('es')).toEqual({ ok: false, code: 'save_failed' })
    expect(jar.get('NEXT_LOCALE')).toBe('en')
  })
  it("one user's switch never changes another user's row", async () => {
    await signIn('alice')
    await saveLocalePreference('es')
    expect(db.profiles.get('bob')!.locale).toBe('en')
  })
})

describe('RLS: a user can only set their own locale (20261004120000_profiles_locale.sql)', () => {
  const sql = readFileSync(
    join(__dirname, '..', '..', 'supabase', 'migrations', '20261004120000_profiles_locale.sql'),
    'utf8'
  )
  const fn = sql.slice(sql.indexOf('create or replace function public.set_own_locale'), sql.indexOf('revoke all on function'))
  it('set_own_locale takes only the locale (no user id) and writes only auth.uid()', () => {
    expect(fn).toMatch(/set_own_locale\(p_locale text\)/)
    expect(fn).toMatch(/where id = auth\.uid\(\)/)
    expect(fn).toMatch(/auth\.uid\(\) is null/)
  })
  it('anon cannot call it, and no client UPDATE policy is added on profiles', () => {
    expect(sql).toMatch(/revoke all on function public\.set_own_locale\(text\) from anon/)
    expect(sql).toMatch(/grant execute on function public\.set_own_locale\(text\) to authenticated/)
    expect(sql).not.toMatch(/create policy[\s\S]*for update/i)
  })
  it('the app never sends a user id to the RPC', () => {
    const src = readFileSync(join(__dirname, '..', 'app', 'language-actions.ts'), 'utf8')
    expect(src).toContain("rpc('set_own_locale', { p_locale: locale })")
    expect(src).not.toMatch(/from\('profiles'\)\.update/)
  })
})
