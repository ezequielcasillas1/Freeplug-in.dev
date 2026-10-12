// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Round 6: the "Confirm signup" template (SUPABASE-AUTH-CHECKLIST.md) sends claim sign-ups back to /claim
 * with `{{ if .Data.freeplug_claim }}`, so signUp must set that metadata for next=/claim, and only then.
 */
const signUpSpy = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signUp: signUpSpy } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/rate-limit', () => ({ hashRateKey: (k: string) => k, rateCheck: async () => true, rateDecision: async () => 'allowed' }))
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => ({}) }))

import { signUp } from './actions'

function form(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries({ email: 'new@example.com', password: 'secret123', confirm: 'secret123', ...fields })) f.set(k, v)
  return f
}
async function run(fields: Record<string, string>) {
  await signUp(form(fields)).catch((e: { url?: string }) => {
    if (!e.url) throw e
  })
  return signUpSpy.mock.calls.at(-1)![0].options as { emailRedirectTo: string; data?: Record<string, unknown> }
}

describe('signUp metadata for the Confirm signup template', () => {
  beforeEach(() => {
    signUpSpy.mockReset()
    signUpSpy.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null })
  })
  it('claim sign-up: freeplug_claim true (plus business_name when given)', async () => {
    expect((await run({ next: '/claim' })).data).toEqual({ freeplug_claim: true })
    const withName = (await run({ next: '/claim', business_name: 'Tacos Kyle' })).data
    expect(withName?.freeplug_claim).toBe(true)
  })
  it('any other sign-up: no freeplug_claim', async () => {
    expect((await run({})).data?.freeplug_claim).toBeUndefined()
    expect((await run({ next: '/dashboard' })).data?.freeplug_claim).toBeUndefined()
    expect((await run({ next: '/claim/' })).data?.freeplug_claim).toBeUndefined()
  })
})
