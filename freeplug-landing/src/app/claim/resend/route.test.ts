// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * POST /claim/resend (round 7): "Send it again" in the confirm-email box. Runs the real route and
 * the real resendSignupConfirmation; only Supabase (auth.getUser / auth.resend), the request
 * headers and the rate_check database call are stood in for. rate_check is simulated in memory
 * with the same "count hits in the window, refuse at the limit" rule as public.rate_check.
 */
const h = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string; email_confirmed_at?: string | null },
  resend: vi.fn(),
  hits: new Map<string, number[]>(),
  headers: {} as Record<string, string>,
  rateDown: false,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: h.user } }),
      resend: h.resend,
    },
  }),
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers(h.headers) }))
vi.mock('@/lib/rate-limit', () => ({
  rateCheck: async (rule: { bucket: string; limit: number; windowSeconds: number }, key: string) => {
    if (h.rateDown) return false
    const k = `${rule.bucket}:${key}`
    const now = Date.now()
    const list = (h.hits.get(k) ?? []).filter((t) => t > now - rule.windowSeconds * 1000)
    if (list.length >= rule.limit) {
      h.hits.set(k, list)
      return false
    }
    list.push(now)
    h.hits.set(k, list)
    return true
  },
}))

import * as route from './route'
import { RESEND_LIMITS } from '@/lib/outreach/resend-confirmation'

const { POST } = route
const UID = 'e2e00000-0000-4000-8000-000000000021'
const OWN = 'unconfirmed-r7@local.test'

type Opts = { origin?: string | null; site?: string | null; body?: BodyInit | null; query?: string; contentType?: string }
const req = ({ origin = 'null', site = 'same-origin', body = null, query = '', contentType }: Opts = {}) => {
  const headers = new Headers()
  if (origin) headers.set('origin', origin)
  if (site) headers.set('sec-fetch-site', site)
  if (contentType) headers.set('content-type', contentType)
  return new Request(`https://freeplug-in.dev/claim/resend${query}`, { method: 'POST', headers, body }) as never
}
const call = async (o?: Opts) => {
  const res = await POST(req(o))
  return { status: res.status, outcome: ((await res.json()) as { outcome: string }).outcome, cache: res.headers.get('cache-control') }
}

describe('/claim/resend (round 7)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-27T07:10:00Z'))
    h.user = { id: UID, email: OWN, email_confirmed_at: null }
    h.resend.mockReset()
    h.resend.mockResolvedValue({ data: {}, error: null })
    h.hits.clear()
    h.headers = {}
    h.rateDown = false
  })
  afterEach(() => vi.useRealTimers())

  it('limits are 1 per 60 s and 5 per hour per user, 20 per hour per trusted IP, 100 per hour for the shared bucket', () => {
    expect(RESEND_LIMITS.perUserMinute).toMatchObject({ limit: 1, windowSeconds: 60 })
    expect(RESEND_LIMITS.perUserHour).toMatchObject({ limit: 5, windowSeconds: 3600 })
    expect(RESEND_LIMITS.perIp).toMatchObject({ limit: 20, windowSeconds: 3600 })
    expect(RESEND_LIMITS.sharedIp).toMatchObject({ limit: 100, windowSeconds: 3600 })
  })

  it('success: 200 "sent", Supabase resend type "signup" to the signed-in user\'s own email, redirect back to /claim', async () => {
    expect(await call()).toEqual({ status: 200, outcome: 'sent', cache: 'private, no-store' })
    expect(h.resend).toHaveBeenCalledTimes(1)
    const [arg] = h.resend.mock.calls[0]
    expect(arg.type).toBe('signup')
    expect(arg.email).toBe(OWN)
    expect(arg.options.emailRedirectTo).toMatch(/\/auth\/callback\?next=%2Fclaim$/)
  })

  it('an email from the client (JSON body, form body, query string) is ignored: always the session user\'s own address', async () => {
    const evil = 'attacker@evil.example'
    await call({ body: JSON.stringify({ email: evil, type: 'signup' }), contentType: 'application/json', query: `?email=${evil}` })
    vi.setSystemTime(Date.now() + 61_000)
    await call({ body: new URLSearchParams({ email: evil }), query: `?email=${encodeURIComponent(evil)}` })
    expect(h.resend).toHaveBeenCalledTimes(2)
    for (const [arg] of h.resend.mock.calls) {
      expect(arg.email).toBe(OWN)
      expect(JSON.stringify(arg)).not.toContain(evil)
    }
  })

  it('rate limited: a second tap within 60 s -> 429 "limited", nothing sent; after 60 s it sends again', async () => {
    expect((await call()).outcome).toBe('sent')
    vi.setSystemTime(Date.now() + 30_000)
    expect(await call()).toMatchObject({ status: 429, outcome: 'limited' })
    expect(h.resend).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + 31_000)
    expect((await call()).outcome).toBe('sent')
    expect(h.resend).toHaveBeenCalledTimes(2)
  })

  it('rate limited: at most 5 per hour per user even when spaced out; the hour window then reopens', async () => {
    const out: string[] = []
    for (let i = 0; i < 7; i++) {
      out.push((await call()).outcome)
      vi.setSystemTime(Date.now() + 61_000)
    }
    expect(out).toEqual(['sent', 'sent', 'sent', 'sent', 'sent', 'limited', 'limited'])
    expect(h.resend).toHaveBeenCalledTimes(5)
    vi.setSystemTime(Date.now() + 3600_000)
    expect((await call()).outcome).toBe('sent')
  })

  it('per-IP limit: 20 per hour per trusted IP across users; without a trusted IP everyone shares one bucket (100 per hour)', async () => {
    vi.stubEnv('TRUST_CF_CONNECTING_IP', 'true')
    try {
      h.headers = { 'cf-connecting-ip': '203.0.113.9' }
      const out: string[] = []
      for (let i = 0; i < 21; i++) {
        h.user = { id: `e2e00000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`, email: `u${i}@local.test`, email_confirmed_at: null }
        out.push((await call()).outcome)
      }
      expect(out.filter((o) => o === 'sent')).toHaveLength(20)
      expect(out[20]).toBe('limited')
    } finally {
      vi.unstubAllEnvs()
    }
    // Header not trusted (flag off): a rotating CF-Connecting-IP lands in the shared bucket.
    h.hits.clear()
    const shared: string[] = []
    for (let i = 0; i < 101; i++) {
      h.headers = { 'cf-connecting-ip': `198.51.100.${i % 250}` }
      h.user = { id: `e2e00000-0000-4000-8000-000000002${String(i).padStart(3, '0')}`, email: `s${i}@local.test`, email_confirmed_at: null }
      shared.push((await call()).outcome)
    }
    expect(shared.filter((o) => o === 'sent')).toHaveLength(100)
    expect(shared[100]).toBe('limited')
    expect([...h.hits.keys()].some((k) => k.startsWith('claim_resend_shared_ip:unknown-ip'))).toBe(true)
  })

  it("Supabase's own resend limit (429) and its email-limit error codes also show as limited", async () => {
    h.resend.mockResolvedValue({ data: null, error: { message: 'For security purposes, you can only request this after 60 seconds.', status: 429 } })
    expect(await call()).toMatchObject({ status: 429, outcome: 'limited' })
    for (const code of ['over_email_send_rate_limit', 'over_request_rate_limit']) {
      vi.setSystemTime(Date.now() + 61_000)
      h.resend.mockResolvedValue({ data: null, error: { message: 'Email rate limit exceeded', status: 400, code } })
      expect(await call()).toMatchObject({ status: 429, outcome: 'limited' })
    }
  })

  it('generic failure: a Supabase error or a thrown error -> 502 "error" (the box shows the generic line)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    h.resend.mockResolvedValue({ data: null, error: { message: 'boom', status: 500 } })
    expect(await call()).toMatchObject({ status: 502, outcome: 'error' })
    vi.setSystemTime(Date.now() + 61_000)
    h.resend.mockRejectedValue(new TypeError('fetch failed'))
    expect(await call()).toMatchObject({ status: 502, outcome: 'error' })
    err.mockRestore()
  })

  it('rate limiter unavailable: fails closed as limited, nothing sent', async () => {
    h.rateDown = true
    expect(await call()).toMatchObject({ status: 429, outcome: 'limited' })
    expect(h.resend).not.toHaveBeenCalled()
  })

  it('already confirmed: 200 "confirmed", nothing sent and no rate hit used (the page just moves on)', async () => {
    h.user = { id: UID, email: OWN, email_confirmed_at: '2026-09-27T07:00:00Z' }
    expect(await call()).toMatchObject({ status: 200, outcome: 'confirmed' })
    expect(h.resend).not.toHaveBeenCalled()
    expect(h.hits.size).toBe(0)
  })

  it('not signed in: 401 "signed_out", nothing sent', async () => {
    h.user = null
    expect(await call({ body: JSON.stringify({ email: 'someone@example.com' }), contentType: 'application/json' })).toMatchObject({ status: 401, outcome: 'signed_out' })
    expect(h.resend).not.toHaveBeenCalled()
  })

  it('a signed-in account without an email: "error", nothing sent', async () => {
    h.user = { id: UID, email: '', email_confirmed_at: null }
    expect((await call()).outcome).toBe('error')
    expect(h.resend).not.toHaveBeenCalled()
  })

  it('cross-site POSTs: 403, nothing sent; GET is not exported (Next answers 405)', async () => {
    for (const o of [{ origin: 'https://evil.example', site: 'cross-site' }, { origin: 'https://evil.example', site: null }, { origin: null, site: 'cross-site' }, { origin: 'null', site: 'same-site' }]) {
      expect(await call(o)).toMatchObject({ status: 403, outcome: 'forbidden' })
    }
    expect(h.resend).not.toHaveBeenCalled()
    expect('GET' in route).toBe(false)
  })
})
