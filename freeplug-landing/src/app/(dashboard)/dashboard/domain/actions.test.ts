// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const gate = vi.fn()
const insert = vi.fn()
vi.mock('@/lib/consultation/gate', () => ({ checkConsultationGate: (...a: unknown[]) => gate(...a) }))
vi.mock('@/i18n/current-locale', () => ({ currentLocale: async () => 'en' }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ insert: (row: unknown) => insert(row) }),
  }),
}))

import { requestDomainSetup } from './actions'
import { CONSULTATION_GATE_MESSAGE } from '@/lib/consultation/copy'

describe('requestDomainSetup consultation gate (Oct 22 r2)', () => {
  beforeEach(() => {
    gate.mockReset()
    insert.mockReset()
    insert.mockResolvedValue({ error: null })
  })

  it('buying a domain before Looks good is refused and nothing is saved', async () => {
    gate.mockResolvedValue({ ok: false, requestId: 'r1', code: 'consultation_not_agreed', message: CONSULTATION_GATE_MESSAGE })
    expect(await requestDomainSetup({ kind: 'need_domain' })).toEqual({ ok: false, error: CONSULTATION_GATE_MESSAGE, code: 'consultation_not_agreed' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('buying a domain after Looks good (or with no open request) is saved', async () => {
    gate.mockResolvedValue({ ok: true, requestId: 'r1' })
    expect(await requestDomainSetup({ kind: 'need_domain' })).toEqual({ ok: true })
    expect(insert).toHaveBeenCalledOnce()
  })

  it('connecting an owned domain is never gated', async () => {
    expect(await requestDomainSetup({ kind: 'have_domain', domain: 'mine.com' })).toEqual({ ok: true })
    expect(gate).not.toHaveBeenCalled()
  })

  it('fails closed when the gate cannot be checked', async () => {
    gate.mockRejectedValue(new Error('db down'))
    const r = await requestDomainSetup({ kind: 'need_domain' })
    expect(r.ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('maps the database gate (trigger hint) to the same message', async () => {
    gate.mockResolvedValue({ ok: true, requestId: null })
    insert.mockResolvedValue({ error: { message: 'x', hint: 'consultation_not_agreed' } })
    expect(await requestDomainSetup({ kind: 'need_domain' })).toEqual({ ok: false, error: CONSULTATION_GATE_MESSAGE, code: 'consultation_not_agreed' })
  })
})
