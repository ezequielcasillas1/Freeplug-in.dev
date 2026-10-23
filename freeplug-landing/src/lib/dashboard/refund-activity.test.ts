// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { downgradeRefundActivityRow, refundActivityLabel } from './billing-activity'

describe('Refund row in Recent activity (Cheke, Oct 23)', () => {
  it('EN and ES labels', () => {
    expect(refundActivityLabel(5000, '2026-10-23T17:00:00Z', 'downgrade', 'en')).toBe('Refund of $50.00 on Oct 23, 2026 for your switch to a lower plan')
    expect(refundActivityLabel(5000, '2026-10-23T17:00:00Z', 'downgrade', 'es')).toMatch(/^Reembolso de .*50\.00.* por tu cambio a un plan más bajo$/)
    expect(refundActivityLabel(5000, '2026-10-23T17:00:00Z', 'downgrade', 'en', undefined, 'buyout')).toBe('Refund of $50.00 on Oct 23, 2026, added toward your buyout')
    expect(refundActivityLabel(5000, '2026-10-23T17:00:00Z', 'downgrade', 'en', undefined, 'wallet')).toBe('Refund of $50.00 on Oct 23, 2026, added to your Freeplug wallet')
    expect(refundActivityLabel(5000, '2026-10-23T17:00:00Z', 'downgrade', 'es', undefined, 'buyout')).toContain(', sumado a la compra de tu sitio')
    expect(refundActivityLabel(5000, '2026-10-23T17:00:00Z', 'downgrade', 'es', undefined, 'wallet')).toContain('agregado a tu billetera Freeplug')
    expect(refundActivityLabel(5000, null, 'other', 'en')).toBe('Refund of $50.00')
    expect(refundActivityLabel(null, null, null, 'es')).toBe('Reembolso')
  })
  it('one row per subscription+invoice (a retry after a failed switch adds nothing)', () => {
    const a = downgradeRefundActivityRow({ subscriptionId: 'sub_1', userId: 'u1', invoiceId: 'in_1', refundId: 're_1', refundCents: 5000, choice: 'wallet' })
    const b = downgradeRefundActivityRow({ subscriptionId: 'sub_1', userId: 'u1', invoiceId: 'in_1', refundId: null, refundCents: 5000, choice: 'wallet' })
    expect(a?.activity_key).toBe(b?.activity_key)
    expect(a).toMatchObject({ kind: 'refund', reason: 'downgrade', amount_cents: 5000, profile_id: 'u1', credit_choice: 'wallet', stripe_balance_txn_id: 're_1' })
  })
  it('buyout choice has no balance txn id', () => {
    expect(downgradeRefundActivityRow({ subscriptionId: 's', userId: 'u', invoiceId: 'i', refundId: null, refundCents: 5000, choice: 'buyout' })).toMatchObject({ credit_choice: 'buyout', stripe_balance_txn_id: null })
  })
  it('no user or no amount = no row', () => {
    expect(downgradeRefundActivityRow({ subscriptionId: 's', userId: null, invoiceId: 'i', refundId: null, refundCents: 5000, choice: 'wallet' })).toBeNull()
    expect(downgradeRefundActivityRow({ subscriptionId: 's', userId: 'u', invoiceId: 'i', refundId: null, refundCents: 0, choice: 'buyout' })).toBeNull()
  })
  it('migration: client can only read own rows, cannot write', () => {
    const sql = readFileSync('supabase/migrations/20261023120000_billing_activity_refunds.sql', 'utf8')
    expect(sql).toMatch(/revoke all on table public\.billing_activity from public, anon, authenticated/)
    expect(sql).toMatch(/grant select on table public\.billing_activity to authenticated;/)
    expect(sql).toMatch(/using \(profile_id = \(select auth\.uid\(\)\)\)/)
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*to authenticated/)
  })
})
