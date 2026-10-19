import { describe, expect, it } from 'vitest'
import { normalizeEmail, recipientFromParams, signUnsubscribeToken, verifyUnsubscribeToken } from './token'
import { recordOptOut, type OptOut, type OptOutStore } from './store'

const S = 'test-secret-not-real'
const memStore = () => {
  const rows: OptOut[] = []
  const store: OptOutStore = {
    async record(o) { if (!rows.some((r) => r.email === o.email)) rows.push(o) }, // unique email, ON CONFLICT DO NOTHING
    async optedOut(emails) { return new Set(rows.map((r) => r.email).filter((e) => emails.includes(e))) },
  }
  return { rows, store }
}

describe('unsubscribe token', () => {
  it('round-trips a signed token and normalizes the email', async () => {
    const t = await signUnsubscribeToken(' Owner@Shop.COM ', S)
    expect(await verifyUnsubscribeToken(t, S)).toBe('owner@shop.com')
  })
  it('rejects a tampered token, a wrong secret, a missing secret and junk', async () => {
    const t = await signUnsubscribeToken('a@b.co', S)
    const [p, sig] = t.split('.')
    const other = (await signUnsubscribeToken('x@b.co', S)).split('.')[0]
    expect(await verifyUnsubscribeToken(`${other}.${sig}`, S)).toBeNull()
    expect(await verifyUnsubscribeToken(`${p}.${sig}`, 'other')).toBeNull()
    expect(await verifyUnsubscribeToken(t, undefined)).toBeNull()
    expect(await verifyUnsubscribeToken('nope', S)).toBeNull()
  })
  it('matches the sender (node:crypto HMAC, base64url)', async () => {
    const { createHmac } = await import('node:crypto')
    const e = 'a@b.co'
    const want = `${Buffer.from(e).toString('base64url')}.${createHmac('sha256', S).update(e).digest('base64url')}`
    expect(await signUnsubscribeToken(e, S)).toBe(want)
  })
  it('recipientFromParams: signed tokens only; plain ?e= emails, tampered, wrong-secret and junk tokens are all rejected', async () => {
    const t = await signUnsubscribeToken('a@b.co', S)
    expect(await recipientFromParams({ t }, S)).toEqual({ email: 'a@b.co', kind: 'signed' })
    expect(await recipientFromParams({ e: 'c@d.co' } as never, S)).toBeNull()
    expect(await recipientFromParams({ t: 'bad', e: 'c@d.co' } as never, S)).toBeNull()
    const [p, sig] = t.split('.')
    expect(await recipientFromParams({ t: `${p}.${sig.slice(0, -2)}xx` }, S)).toBeNull()
    expect(await recipientFromParams({ t: `${Buffer.from('victim@x.co').toString('base64url')}.${sig}` }, S)).toBeNull()
    expect(await recipientFromParams({ t }, 'wrong')).toBeNull()
    expect(await recipientFromParams({ t }, undefined)).toBeNull()
    expect(await recipientFromParams({}, S)).toBeNull()
    expect(normalizeEmail('x')).toBeNull()
  })
})

describe('recordOptOut', () => {
  it('records the opt-out with email, source and time; a replay adds nothing', async () => {
    const { rows, store } = memStore()
    const at = new Date('2026-10-19T06:00:00Z')
    expect(await recordOptOut(store, { email: 'A@B.co', source: 'unsubscribe_page', tokenKind: 'signed', at })).toEqual({ ok: true })
    await recordOptOut(store, { email: 'a@b.co', source: 'one_click', tokenKind: 'signed' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ email: 'a@b.co', source: 'unsubscribe_page', at })
    expect(await store.optedOut(['a@b.co', 'z@b.co'])).toEqual(new Set(['a@b.co']))
  })
  it('a failed write is reported, not thrown; a bad email is refused', async () => {
    const bad: OptOutStore = { record: async () => { throw new Error('db down') }, optedOut: async () => new Set() }
    expect(await recordOptOut(bad, { email: 'a@b.co', source: 'unsubscribe_page', tokenKind: 'signed' })).toEqual({ ok: false })
    expect(await recordOptOut(memStore().store, { email: 'nope', source: 'unsubscribe_page', tokenKind: 'signed' })).toEqual({ ok: false })
  })
})

describe('migration: one row per normalized email', () => {
  it('has a unique index on email and an ON CONFLICT DO NOTHING insert', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync(`${__dirname}/../../../supabase/migrations/20261019090000_email_opt_outs.sql`, 'utf8')
    expect(sql).toMatch(/create unique index if not exists email_opt_outs_email_key on public\.email_opt_outs \(email\)/)
    expect(sql).toMatch(/on conflict \(email\) do nothing/)
    expect(sql).toMatch(/email = lower\(btrim\(email\)\)/)
  })
})
describe('page and action never read ?e=', () => {
  it('no e= param in the unsubscribe code paths', async () => {
    const { readFileSync } = await import('node:fs')
    for (const f of ['../../app/unsubscribe/page.tsx', '../../app/unsubscribe/actions.ts', '../../app/unsubscribe/UnsubscribeForm.tsx', './token.ts'])
      expect(readFileSync(`${__dirname}/${f}`, 'utf8')).not.toMatch(/form\.get\('e'\)|name="e"|params\.e\b|\?e=/)
  })
})
