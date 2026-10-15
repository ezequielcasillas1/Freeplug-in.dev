// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A fake public.rate_check: fixed windows keyed by (bucket, key), driven by fake timers.
const counts = new Map<string, { n: number; start: number }>()
let dbDown = false
const rpc = vi.fn(async (_fn: string, a: { p_bucket: string; p_key: string; p_limit: number; p_window_seconds: number }) => {
  if (dbDown) return { data: null, error: { message: 'down' } }
  const k = `${a.p_bucket}|${a.p_key}`
  const now = Date.now()
  const c = counts.get(k)
  if (!c || now - c.start >= a.p_window_seconds * 1000) {
    counts.set(k, { n: 1, start: now })
    return { data: true, error: null }
  }
  c.n += 1
  return { data: c.n <= a.p_limit, error: null }
})
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }))

import { RESET_LIMITS, isResetThrottled } from './reset-rate-limit'
import { SHARED_IP_BUCKET } from '@/lib/rate-limit/client-ip'

const MIN = 60_000
const HOUR = 60 * MIN
let seq = 0
const freshEmail = () => `user${++seq}@example.com`
const freshIp = () => `198.51.100.${++seq % 250}`

describe('forgot-password rate limits', () => {
  beforeEach(() => {
    counts.clear()
    dbDown = false
    rpc.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T00:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('has the agreed caps', () => {
    expect(RESET_LIMITS.perEmailMinute).toMatchObject({ limit: 1, windowSeconds: 60 })
    expect(RESET_LIMITS.perEmailHour).toMatchObject({ limit: 5, windowSeconds: 3600 })
    expect(RESET_LIMITS.perEmailDay).toMatchObject({ limit: 10, windowSeconds: 86_400 })
    expect(RESET_LIMITS.perIp).toMatchObject({ limit: 20, windowSeconds: 3600 })
  })

  it('per address: 1 per minute (case-insensitive)', async () => {
    const e = freshEmail()
    expect(await isResetThrottled(e, freshIp())).toBe(false)
    expect(await isResetThrottled(e.toUpperCase(), freshIp())).toBe(true)
    vi.advanceTimersByTime(MIN)
    expect(await isResetThrottled(e, freshIp())).toBe(false)
  })

  it('per address: 5 per hour', async () => {
    const e = freshEmail()
    for (let i = 0; i < 5; i++) {
      expect(await isResetThrottled(e, freshIp())).toBe(false)
      vi.advanceTimersByTime(MIN)
    }
    expect(await isResetThrottled(e, freshIp())).toBe(true)
  })

  it('per address: 10 per day', async () => {
    const e = freshEmail()
    let allowed = 0
    for (let i = 0; i < 40; i++) {
      if (!(await isResetThrottled(e, freshIp()))) allowed++
      vi.advanceTimersByTime(20 * MIN)
    }
    // 40 tries over ~13h: the hourly cap alone would allow more, the daily cap stops at 10.
    expect(allowed).toBe(10)
  })

  it('per IP: 20 per hour across different addresses', async () => {
    const ip = '203.0.113.7'
    for (let i = 0; i < 20; i++) expect(await isResetThrottled(freshEmail(), ip)).toBe(false)
    expect(await isResetThrottled(freshEmail(), ip)).toBe(true)
    vi.advanceTimersByTime(HOUR)
    expect(await isResetThrottled(freshEmail(), ip)).toBe(false)
  })

  it('does not apply the per-IP cap to the shared untrusted bucket', async () => {
    for (let i = 0; i < 25; i++) expect(await isResetThrottled(freshEmail(), SHARED_IP_BUCKET)).toBe(false)
    expect(rpc.mock.calls.some(([, a]) => a.p_bucket === RESET_LIMITS.perIp.bucket)).toBe(false)
  })

  it('never sends the raw address or IP to the database', async () => {
    await isResetThrottled('Secret@Example.com', '203.0.113.8')
    const sent = JSON.stringify(rpc.mock.calls)
    expect(sent).not.toMatch(/secret@example\.com/i)
    expect(sent).not.toContain('203.0.113.8')
  })

  it('database down: per-IP fails closed (rateCheck)', async () => {
    dbDown = true
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await isResetThrottled(freshEmail(), '203.0.113.9')).toBe(true)
    quiet.mockRestore()
  })

  it('database down: per-address falls back to the same caps in memory', async () => {
    dbDown = true
    const quietE = vi.spyOn(console, 'error').mockImplementation(() => {})
    const quietW = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = freshEmail()
    expect(await isResetThrottled(e, SHARED_IP_BUCKET)).toBe(false)
    expect(await isResetThrottled(e, SHARED_IP_BUCKET)).toBe(true)
    expect(quietW.mock.calls.join(' ')).not.toContain(e)
    quietE.mockRestore()
    quietW.mockRestore()
  })
})
