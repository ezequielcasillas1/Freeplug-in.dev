// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { PLAN_STEPS } from '../plans/ladder'
import { expireUnsellableCheckoutSessions } from './expire-unsellable-checkouts'
import { checkoutSessionExpiresAt, CHECKOUT_SESSION_TTL_SECONDS } from './checkout-expiry'

type S = { id: string; mode: string; status: string; metadata: Record<string, string>; lookup?: string; closesOnExpire?: string }

function fakeStripe(sessions: S[], pageSize = 100) {
  const expire = vi.fn(async (id: string) => {
    const s = sessions.find((x) => x.id === id)!
    if (s.closesOnExpire) {
      s.status = s.closesOnExpire
      throw Object.assign(new Error('Only Checkout Sessions with a status in [open] can be expired.'), { type: 'StripeInvalidRequestError' })
    }
    s.status = 'expired'
    return s
  })
  const stripe = {
    checkout: {
      sessions: {
        list: vi.fn(async (q: { status: string; limit: number; starting_after?: string }) => {
          const open = sessions.filter((s) => s.status === 'open')
          const start = q.starting_after ? open.findIndex((s) => s.id === q.starting_after) + 1 : 0
          const data = open.slice(start, start + pageSize)
          return { data, has_more: start + pageSize < open.length }
        }),
        listLineItems: vi.fn(async (id: string) => ({ data: [{ price: { lookup_key: sessions.find((s) => s.id === id)!.lookup ?? null } }] })),
        expire,
        retrieve: vi.fn(async (id: string) => sessions.find((s) => s.id === id)!),
      },
    },
  }
  return { stripe: stripe as never, expire, listLineItems: stripe.checkout.sessions.listLineItems }
}

const base = (): S[] => [
  { id: 'cs_leads_meta', mode: 'subscription', status: 'open', metadata: { type: 'hosting', plan_step: 'leads' } },
  { id: 'cs_growth_lookup', mode: 'subscription', status: 'open', metadata: {}, lookup: 'freeplug_step_growth_monthly' },
  { id: 'cs_starter', mode: 'subscription', status: 'open', metadata: { type: 'hosting', plan_step: 'starter' } },
  { id: 'cs_maint', mode: 'payment', status: 'open', metadata: { type: 'maintenance' } },
  { id: 'cs_setup', mode: 'setup', status: 'open', metadata: { type: 'outreach_setup' } },
  { id: 'cs_legacy', mode: 'subscription', status: 'open', metadata: { type: 'hosting' }, lookup: 'something_else' },
  { id: 'cs_getfound_paid_meanwhile', mode: 'subscription', status: 'open', metadata: { plan_step: 'get_found' }, closesOnExpire: 'complete' },
]
const quiet = { log: () => undefined }

describe('expireUnsellableCheckoutSessions', () => {
  it('expires open sessions for non-sellable steps only (by metadata or price lookup key)', async () => {
    const f = fakeStripe(base())
    const r = await expireUnsellableCheckoutSessions(f.stripe, quiet)
    expect(r.expired).toEqual([
      { id: 'cs_leads_meta', step: 'leads' },
      { id: 'cs_growth_lookup', step: 'growth' },
    ])
    expect(r.alreadyClosed).toEqual([{ id: 'cs_getfound_paid_meanwhile', step: 'get_found', status: 'complete' }])
    expect(r).toMatchObject({ checked: 7, kept: 4 })
    expect(f.expire).not.toHaveBeenCalledWith('cs_starter')
  })

  it('is idempotent: a second run expires nothing', async () => {
    const sessions = base()
    await expireUnsellableCheckoutSessions(fakeStripe(sessions).stripe, quiet)
    const f2 = fakeStripe(sessions)
    const r2 = await expireUnsellableCheckoutSessions(f2.stripe, quiet)
    expect(r2.expired).toEqual([])
    expect(f2.expire).not.toHaveBeenCalled()
  })

  it('follows the flag: turning Fast lane off expires its open sessions', async () => {
    const off = PLAN_STEPS.map((p) => (p.id === 'fast_lane' ? { ...p, sellable: false } : p))
    const f = fakeStripe([{ id: 'cs_fl', mode: 'subscription', status: 'open', metadata: { plan_step: 'fast_lane' } }])
    expect((await expireUnsellableCheckoutSessions(f.stripe, { ...quiet, steps: off })).expired).toEqual([{ id: 'cs_fl', step: 'fast_lane' }])
  })

  it('can be scoped to one customer (the test-mode probe)', async () => {
    const f = fakeStripe([])
    await expireUnsellableCheckoutSessions(f.stripe, { ...quiet, customer: 'cus_probe' })
    expect((f.stripe as unknown as { checkout: { sessions: { list: { mock: { calls: unknown[][] } } } } }).checkout.sessions.list.mock.calls[0][0]).toEqual({ status: 'open', limit: 100, customer: 'cus_probe' })
  })

  it('pages through every open session', async () => {
    const many: S[] = Array.from({ length: 5 }, (_, i) => ({ id: `cs_${i}`, mode: 'subscription', status: 'open', metadata: { plan_step: i % 2 ? 'leads' : 'starter' } }))
    const f = fakeStripe(many, 2)
    const r = await expireUnsellableCheckoutSessions(f.stripe, quiet)
    expect(r.checked).toBeGreaterThanOrEqual(5)
    expect(r.expired.map((e) => e.id)).toEqual(['cs_1', 'cs_3'])
  })

  it('an expire error on a session that is still open is thrown (the admin action reports it)', async () => {
    const f = fakeStripe([{ id: 'cs_x', mode: 'subscription', status: 'open', metadata: { plan_step: 'leads' } }])
    f.expire.mockRejectedValueOnce(new Error('rate limited'))
    await expect(expireUnsellableCheckoutSessions(f.stripe, quiet)).rejects.toThrow('rate limited')
  })
})

describe('checkoutSessionExpiresAt', () => {
  it('now + 1 hour, rounded down to the minute (59-60 minutes; Stripe allows 30 min - 24 h)', () => {
    const now = Date.UTC(2026, 9, 3, 18, 7, 42, 500)
    const at = checkoutSessionExpiresAt(now)
    expect(CHECKOUT_SESSION_TTL_SECONDS).toBe(3600)
    expect(at).toBe(Date.UTC(2026, 9, 3, 19, 7, 0) / 1000)
    expect(at - now / 1000).toBeGreaterThan(59 * 60)
    expect(at - now / 1000).toBeLessThanOrEqual(3600)
    expect(checkoutSessionExpiresAt(now + 10_000)).toBe(at) // same minute: same value (idempotency)
  })

  it('every Checkout Session the app creates sets expires_at (source scan)', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const path = await import('node:path')
    const files: string[] = []
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = path.join(d, n)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(n) && !/\.test\.(ts|tsx)$/.test(n)) files.push(p)
      }
    }
    walk(path.join(process.cwd(), 'src'))
    const creators = files.filter((f) => readFileSync(f, 'utf8').includes('checkout.sessions.create('))
    expect(creators.map((f) => path.relative(process.cwd(), f)).sort()).toEqual([
      'src/app/api/checkout/hosting/route.ts',
      'src/app/api/checkout/maintenance/route.ts',
      'src/lib/outreach/server.ts',
    ])
    for (const f of creators) {
      const src = readFileSync(f, 'utf8')
      const at = src.indexOf('checkout.sessions.create(')
      expect(src.slice(at, at + 700), f).toMatch(/expires_at: (expiresAt|checkoutSessionExpiresAt\(\))/)
    }
  })
})
