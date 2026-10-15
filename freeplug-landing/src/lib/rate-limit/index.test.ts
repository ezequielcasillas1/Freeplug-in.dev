// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
// Plain (non-spy) stand-in used when the client itself throws.
let brokenClient = false
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    if (brokenClient) throw new TypeError('network')
    return { rpc }
  },
}))

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { HELP_CHAT_LIMIT, hashRateKey, rateCheck, rateDecision } from './index'
import { clientIpFrom } from './client-ip'

describe('shared rate limiter', () => {
  beforeEach(() => {
    rpc.mockReset()
    brokenClient = false
  })

  it('calls rate_check with a hashed key (never the raw IP or id)', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    expect(await rateCheck(HELP_CHAT_LIMIT, '203.0.113.9')).toBe(true)
    const [fn, args] = rpc.mock.calls[0]
    expect(fn).toBe('rate_check')
    expect(args).toEqual({ p_bucket: 'help_chat_user', p_key: hashRateKey('203.0.113.9'), p_limit: 10, p_window_seconds: 3600 })
    expect(JSON.stringify(args)).not.toContain('203.0.113.9')
  })

  it('reports "over the limit" when the database says so', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    expect(await rateCheck(HELP_CHAT_LIMIT, 'u')).toBe(false)
  })

  it('fails closed on a database error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await rateCheck(HELP_CHAT_LIMIT, 'u')).toBe(false)
  })

  it('fails closed when the client throws', async () => {
    brokenClient = true
    expect(await rateCheck(HELP_CHAT_LIMIT, 'u')).toBe(false)
  })

  describe('faked X-Forwarded-For never gets around a per-IP limit (Vera QA #3)', () => {
    const rule = { bucket: 'test_per_ip', limit: 3, windowSeconds: 60 }
    const counting = () => {
      const hits = new Map<string, number>()
      rpc.mockImplementation(async (_fn: string, a: { p_key: string; p_limit: number }) => {
        const n = (hits.get(a.p_key) ?? 0) + 1
        hits.set(a.p_key, n)
        return { data: n <= a.p_limit, error: null }
      })
    }
    const send = async (headers: Record<string, string>) => rateCheck(rule, clientIpFrom(new Headers(headers), {}))

    it('rotating a fake X-Forwarded-For without a trusted CF-Connecting-IP', async () => {
      counting()
      const out = []
      for (let i = 1; i <= 6; i++) out.push(await send({ 'x-forwarded-for': `10.0.0.${i}`, 'x-real-ip': `10.0.1.${i}` }))
      expect(out).toEqual([true, true, true, false, false, false])
    })

    it('rotating a fake X-Forwarded-For next to a trusted CF-Connecting-IP', async () => {
      counting()
      const out = []
      for (let i = 1; i <= 5; i++) out.push(await rateCheck(rule, clientIpFrom(new Headers({ 'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': `10.0.0.${i}` }), { TRUST_CF_CONNECTING_IP: 'true' })))
      expect(out).toEqual([true, true, true, false, false])
    })

    it('sending neither header', async () => {
      counting()
      const out = []
      for (let i = 1; i <= 4; i++) out.push(await send({}))
      expect(out).toEqual([true, true, true, false])
    })
  })

  describe('fail-open is for the password reset ONLY (Aria, round 5)', () => {
    it('rateDecision reports allowed / limited / error; rateCheck maps error to "limited" (fail closed, unchanged)', async () => {
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
      rpc.mockResolvedValueOnce({ data: true, error: null })
      expect(await rateDecision(HELP_CHAT_LIMIT, 'u')).toBe('allowed')
      rpc.mockResolvedValueOnce({ data: false, error: null })
      expect(await rateDecision(HELP_CHAT_LIMIT, 'u')).toBe('limited')
      rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      expect(await rateDecision(HELP_CHAT_LIMIT, 'u')).toBe('error')
      brokenClient = true
      expect(await rateDecision(HELP_CHAT_LIMIT, 'u')).toBe('error')
      expect(await rateCheck(HELP_CHAT_LIMIT, 'u')).toBe(false)
      brokenClient = false
      rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      expect(await rateCheck(HELP_CHAT_LIMIT, 'u')).toBe(false)
      quiet.mockRestore()
    })

    it('only src/lib/auth/reset-rate-limit.ts uses rateDecision; every other caller still uses rateCheck', () => {
      const src = path.resolve(__dirname, '../..')
      const files: string[] = []
      const walk = (d: string) => {
        for (const n of readdirSync(d)) {
          const p = path.join(d, n)
          if (statSync(p).isDirectory()) walk(p)
          else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) files.push(p)
        }
      }
      walk(src)
      const rel = (f: string) => path.relative(src, f)
      const usesDecision = files.filter((f) => /\brateDecision\((?!\))/.test(readFileSync(f, 'utf8'))).map(rel).sort()
      expect(usesDecision).toEqual(['lib/auth/reset-rate-limit.ts', 'lib/rate-limit/index.ts'])
      const usesCheck = files.filter((f) => /\brateCheck\((?!\))/.test(readFileSync(f, 'utf8'))).map(rel).sort()
      expect(usesCheck).toEqual([
        // upgrade confirm preview (round 4): fails closed to the "charge the difference" fallback
        'app/(dashboard)/dashboard/billing-actions.ts',
        'app/(dashboard)/dashboard/request-website/actions.ts',
        // forgot-password per-IP cap (20/hour) fails closed; the per-address caps use rateDecision
        'lib/auth/reset-rate-limit.ts',
        'lib/outreach/resend-confirmation.ts',
        'lib/outreach/server.ts',
        'lib/rate-limit/index.ts',
      ])
    })
  })
})
