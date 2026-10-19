import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  adminOfferSummary,
  BUY_FOR_ME_CONSENT,
  decideDomainClaim,
  domainIncludedText,
  offerActive,
  offerSpotsLeft,
  submitDomainRequest,
  type DomainOfferClaim,
  type DomainRow,
  type DomainSubmitDeps,
} from './flow'

/** In-memory twin of create_buy_for_me_request(): one lock (like SELECT ... FOR UPDATE) around decide + insert. */
function fakeDb(cap = 100, claimedStart = 0) {
  const included = new Set<string>()
  for (let i = 0; i < claimedStart; i++) included.add(`seed-${i}`)
  let lock: Promise<unknown> = Promise.resolve()
  let n = 0
  const insert = (row: DomainRow) => {
    const run = lock.then(async () => {
      const s = { claimed: included.size, cap }
      await new Promise((r) => setTimeout(r, 1)) // widen the race window
      const claim: DomainOfferClaim = decideDomainClaim(s, included.has(row.user_id))
      if (claim.included) included.add(row.user_id)
      return { id: `r${++n}`, error: null, offer: claim }
    })
    lock = run.catch(() => {})
    return run
  }
  return { insert, included }
}

function deps(insert: DomainSubmitDeps['insert']): DomainSubmitDeps {
  return {
    insert,
    customer: async () => ({ email: null, firstName: null, business: null, freeplugUrl: null, locale: null }),
    sendMail: vi.fn(async () => ({ success: true })),
    alertOwner: vi.fn(),
    background: () => {},
    now: () => new Date('2026-10-19T17:00:00Z'),
  }
}
const buy = { kind: 'buy_for_me', domain: 'anatacos.com', consent: true }
const save = (d: DomainSubmitDeps, user: string) => submitDomainRequest(buy, { userId: user, email: `${user}@x.com`, locale: 'en' }, d)

describe('first-100 domain included offer', () => {
  it('decision: included until the cap, one per user', () => {
    expect(decideDomainClaim({ claimed: 99, cap: 100 }, false)).toEqual({ included: true, reason: 'included', claimed: 100, cap: 100 })
    expect(decideDomainClaim({ claimed: 100, cap: 100 }, false)).toEqual({ included: false, reason: 'offer_ended', claimed: 100, cap: 100 })
    expect(decideDomainClaim({ claimed: 10, cap: 100 }, true)).toEqual({ included: false, reason: 'already_claimed', claimed: 10, cap: 100 })
  })

  it('stops at exactly 100 with 120 concurrent saves', async () => {
    const db = fakeDb()
    const results = await Promise.all(Array.from({ length: 120 }, (_, i) => save(deps(db.insert), `u${i}`)))
    expect(results.every((r) => r.ok)).toBe(true)
    expect(results.filter((r) => r.ok && r.included).length).toBe(100)
    expect(db.included.size).toBe(100)
  })

  it('two saves racing for the last spot: exactly one is included, both are saved', async () => {
    const db = fakeDb(100, 99)
    const d = deps(db.insert)
    const [a, b] = await Promise.all([save(d, 'a'), save(d, 'b')])
    expect([a, b].map((r) => r.ok && r.included).sort()).toEqual([false, true])
    expect(db.included.size).toBe(100)
    const lines = vi.mocked(d.alertOwner).mock.calls.map((c) => Object.fromEntries(c[0].details)['Domain included'])
    expect(lines.sort()).toEqual(['no, offer ended (100 of 100)', 'yes, 100 of 100'])
  })

  it('one claim per user (same user saving twice, even concurrently)', async () => {
    const db = fakeDb()
    const d = deps(db.insert)
    const [a, b] = await Promise.all([save(d, 'same'), save(d, 'same')])
    expect([a, b].filter((r) => r.ok && r.included).length).toBe(1)
    expect(Object.fromEntries(vi.mocked(d.alertOwner).mock.calls[1][0].details)['Domain included']).toMatch(/^no, this customer already has an included domain/)
  })

  it('ended state: buy_for_me still saves + alerts, not included; consent still stored', async () => {
    const db = fakeDb(100, 100)
    const d = deps(db.insert)
    const ins = vi.fn(db.insert)
    d.insert = ins
    expect(await save(d, 'late')).toEqual({ ok: true, id: 'r1', included: false })
    expect(ins.mock.calls[0][0]).toMatchObject({ kind: 'buy_for_me', consent_text: BUY_FOR_ME_CONSENT.en })
    expect(d.alertOwner).toHaveBeenCalledOnce()
    expect(offerActive({ claimed: 100, cap: 100 })).toBe(false)
    expect(offerSpotsLeft({ claimed: 101, cap: 100 })).toBe(0)
  })

  it('other kinds never get an included line', async () => {
    const d = deps(vi.fn(async () => ({ id: 'x', error: null })))
    await submitDomainRequest({ kind: 'buy_self' }, { userId: 'u', email: null, locale: 'en' }, d)
    expect(Object.fromEntries(vi.mocked(d.alertOwner).mock.calls[0][0].details)['Domain included']).toBeNull()
  })

  it('alert text and admin count', () => {
    expect(domainIncludedText({ included: true, reason: 'included', claimed: 37, cap: 100 })).toBe('yes, 37 of 100')
    expect(domainIncludedText(null)).toMatch(/unknown/)
    expect(adminOfferSummary({ claimed: 37, cap: 100 })).toBe('Domain included (first 100): 37 / 100 claimed, 63 left')
    expect(adminOfferSummary({ claimed: 100, cap: 100 })).toBe('Domain included (first 100): 100 / 100 claimed, offer ended')
    expect(adminOfferSummary(null)).toMatch(/unavailable/)
  })

  it('migration: locked claim, cap 100, one per user, service-role only', () => {
    const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261019130000_domain_included_offer.sql'), 'utf8')
    expect(sql).toContain("values ('first_100_domain_included', 100)")
    expect(sql).toMatch(/for update;/)
    expect(sql).toMatch(/on public\.domain_requests \(user_id\) where domain_included/)
    expect(sql).toMatch(/security definer\s+set search_path = ''/)
    expect(sql).toContain('from public, anon, authenticated;\ngrant execute on function public.create_buy_for_me_request(uuid, text, text, text, text, text) to service_role')
  })
})
