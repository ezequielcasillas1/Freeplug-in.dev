import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkConsultationGate, evaluateGate, requestNeedsAgreement } from './gate'
import { CONSULTATION_GATE_MESSAGE } from './copy'

const base = { id: 'r1', status: 'consultation', is_buyout: false, source: 'organic' }

describe('requestNeedsAgreement', () => {
  it.each(['submitted', 'in_review', 'consultation', 'agreed', 'building'])('open organic request (%s) is tied to the gate', (status) => {
    expect(requestNeedsAgreement({ ...base, status })).toBe(true)
  })
  it('closed requests, buyouts, outreach claims and no request are not gated', () => {
    expect(requestNeedsAgreement({ ...base, status: 'closed' })).toBe(false)
    expect(requestNeedsAgreement({ ...base, is_buyout: true })).toBe(false)
    expect(requestNeedsAgreement({ ...base, source: 'outreach' })).toBe(false)
    expect(requestNeedsAgreement(null)).toBe(false)
  })
})

describe('evaluateGate', () => {
  it('blocks without agreed_at, with the swappable copy', () => {
    expect(evaluateGate(base, null)).toEqual({ ok: false, requestId: 'r1', code: 'consultation_not_agreed', message: CONSULTATION_GATE_MESSAGE })
    expect(evaluateGate(base, { agreed_at: null }).ok).toBe(false)
  })
  it('passes with agreed_at on that request', () => {
    expect(evaluateGate(base, { agreed_at: '2026-10-22T20:00:00Z' })).toEqual({ ok: true, requestId: 'r1' })
  })
  it('passes for requests that are not tied', () => {
    expect(evaluateGate({ ...base, is_buyout: true }, null).ok).toBe(true)
    expect(evaluateGate(null, null)).toEqual({ ok: true, requestId: null })
  })
})

/** Minimal chainable fake of the two reads checkConsultationGate makes. */
function fakeDb(tables: Record<string, { data: unknown; error: { message: string } | null }>) {
  const seen: string[] = []
  const db = {
    from(t: string) {
      seen.push(t)
      const res = tables[t] ?? { data: null, error: null }
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) chain[m] = () => chain
      chain.maybeSingle = async () => res
      return chain
    },
  }
  return { db: db as unknown as SupabaseClient, seen }
}

describe('checkConsultationGate', () => {
  it('existing customer with no open request: ok without reading consultations', async () => {
    const { db, seen } = fakeDb({ website_requests: { data: null, error: null } })
    expect(await checkConsultationGate(db, 'u1')).toEqual({ ok: true, requestId: null })
    expect(seen).toEqual(['website_requests'])
  })
  it('blocks an open request whose consultation is not agreed', async () => {
    const { db } = fakeDb({ website_requests: { data: base, error: null }, consultations: { data: { agreed_at: null }, error: null } })
    expect((await checkConsultationGate(db, 'u1')).ok).toBe(false)
  })
  it('blocks an open request with no consultation row yet', async () => {
    const { db } = fakeDb({ website_requests: { data: { ...base, status: 'submitted' }, error: null } })
    expect((await checkConsultationGate(db, 'u1')).ok).toBe(false)
  })
  it('passes when agreed', async () => {
    const { db } = fakeDb({ website_requests: { data: base, error: null }, consultations: { data: { agreed_at: '2026-10-22T20:00:00Z' }, error: null } })
    expect(await checkConsultationGate(db, 'u1')).toEqual({ ok: true, requestId: 'r1' })
  })
  it('fails closed on a read error', async () => {
    const { db } = fakeDb({ website_requests: { data: null, error: { message: 'boom' } } })
    await expect(checkConsultationGate(db, 'u1')).rejects.toThrow(/consultation gate/)
    const two = fakeDb({ website_requests: { data: base, error: null }, consultations: { data: null, error: { message: 'boom' } } })
    await expect(checkConsultationGate(two.db, 'u1')).rejects.toThrow(/consultation gate/)
  })
})
