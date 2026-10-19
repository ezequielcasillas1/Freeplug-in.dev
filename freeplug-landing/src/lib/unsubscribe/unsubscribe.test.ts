import { describe, expect, it } from 'vitest'
import { normalizeEmail, recipientFromParams, signUnsubscribeToken, verifyUnsubscribeToken } from './token'
import { recordOptOut, type OptOut, type OptOutStore } from './store'

const S = 'test-secret-not-real'
const memStore = () => {
  const rows: OptOut[] = []
  const store: OptOutStore = {
    async record(o) { rows.push(o) },
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
  it('recipientFromParams: signed token wins, plain email as fallback, junk is null', async () => {
    const t = await signUnsubscribeToken('a@b.co', S)
    expect(await recipientFromParams({ t, e: 'c@d.co' }, S)).toEqual({ email: 'a@b.co', kind: 'signed' })
    expect(await recipientFromParams({ t: 'bad', e: 'C@d.co' }, S)).toEqual({ email: 'c@d.co', kind: 'email' })
    expect(await recipientFromParams({ e: 'not-an-email' }, S)).toBeNull()
    expect(normalizeEmail('x')).toBeNull()
  })
})

describe('recordOptOut', () => {
  it('records every opt-out with email, source and time; repeats are kept', async () => {
    const { rows, store } = memStore()
    const at = new Date('2026-10-19T06:00:00Z')
    expect(await recordOptOut(store, { email: 'A@B.co', source: 'unsubscribe_page', tokenKind: 'signed', at })).toEqual({ ok: true })
    await recordOptOut(store, { email: 'a@b.co', source: 'one_click', tokenKind: 'signed' })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ email: 'a@b.co', source: 'unsubscribe_page', at })
    expect(await store.optedOut(['a@b.co', 'z@b.co'])).toEqual(new Set(['a@b.co']))
  })
  it('a failed write is reported, not thrown; a bad email is refused', async () => {
    const bad: OptOutStore = { record: async () => { throw new Error('db down') }, optedOut: async () => new Set() }
    expect(await recordOptOut(bad, { email: 'a@b.co', source: 'unsubscribe_page', tokenKind: 'email' })).toEqual({ ok: false })
    expect(await recordOptOut(memStore().store, { email: 'nope', source: 'unsubscribe_page', tokenKind: 'email' })).toEqual({ ok: false })
  })
})
