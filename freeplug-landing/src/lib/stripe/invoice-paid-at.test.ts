// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { invoicePaidAtIso } from './invoice-paid-at'

const T = (iso: string) => Math.floor(Date.parse(iso) / 1000)

describe('invoicePaidAtIso', () => {
  it('status_transitions.paid_at first', () => {
    expect(invoicePaidAtIso({ created: T('2026-10-03T19:03:28Z'), status_transitions: { paid_at: T('2026-10-03T19:03:30Z') } })).toBe('2026-10-03T19:03:30.000Z')
  })
  it('paid_at null or missing: invoice.created', () => {
    expect(invoicePaidAtIso({ created: T('2026-10-03T19:03:28Z'), status_transitions: { paid_at: null } })).toBe('2026-10-03T19:03:28.000Z')
    expect(invoicePaidAtIso({ created: T('2026-10-03T19:03:28Z') })).toBe('2026-10-03T19:03:28.000Z')
  })
  it('neither usable: null', () => {
    expect(invoicePaidAtIso({ created: 0, status_transitions: null })).toBeNull()
    expect(invoicePaidAtIso({} as { created: number })).toBeNull()
  })
})
