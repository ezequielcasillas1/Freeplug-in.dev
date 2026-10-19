import { describe, expect, it } from 'vitest'
import { recordIncludedEdit, type IncludedEditStore } from './included-edits'

type Row = { user_id: string; period_start: string; request_id: string; slot?: number }

/** Both tables as the migrations define them: slots 1..2, one big change a period, one table per request. */
function db(opts: { noSlotColumn?: boolean } = {}) {
  const small: Row[] = []
  const big: Row[] = []
  const dup = (c: string) => ({ code: '23505', message: `duplicate key value violates unique constraint "${c}"` })
  const smallStore: IncludedEditStore = {
    async insertUse(row) {
      if (opts.noSlotColumn && row.slot !== undefined) return { code: 'PGRST204', message: "Could not find the 'slot' column of 'included_edit_uses' in the schema cache" }
      const slot = row.slot ?? 1
      if (slot < 1 || slot > 2) return { code: '23514', message: 'violates check constraint "included_edit_uses_slot_check"' }
      if (big.some((r) => r.request_id === row.request_id)) return { code: 'FP409', message: 'This request is already counted as a big change.' }
      if (small.some((r) => r.request_id === row.request_id)) return dup('included_edit_uses_request_id_key')
      if (small.some((r) => r.user_id === row.user_id && r.period_start === row.period_start && (opts.noSlotColumn || r.slot === slot))) {
        return dup(opts.noSlotColumn ? 'included_edit_uses_user_period_key' : 'included_edit_uses_user_period_slot_key')
      }
      small.push({ ...row, slot })
      return null
    },
  }
  return { small, big, smallStore }
}
const period = new Date('2026-10-01T05:00:00Z')
const next = new Date('2026-11-01T05:00:00Z')

describe('2 small edits a period (step edit + "+1 small edit" add-on)', () => {
  it('Fast lane + add-on: two uses in slots 1 and 2, a third refused; next period starts over', async () => {
    const d = db()
    const use = (requestId: string, at = period) => recordIncludedEdit(d.smallStore, { userId: 'u1', requestId, includedEditsPerMonth: 2, periodStart: at })
    expect(await use('r1')).toEqual({ ok: true, slot: 1 })
    expect(await use('r2')).toEqual({ ok: true, slot: 2 })
    expect(await use('r3')).toMatchObject({ ok: false, reason: 'already_used', message: 'Both included edits for this billing period are already used.' })
    expect(await use('r4', next)).toEqual({ ok: true, slot: 1 })
  })
  it('Starter + add-on (1 a period): the second is refused even though the table has room', async () => {
    const d = db()
    expect(await recordIncludedEdit(d.smallStore, { userId: 'u1', requestId: 'r1', includedEditsPerMonth: 1, periodStart: period })).toEqual({ ok: true, slot: 1 })
    expect(await recordIncludedEdit(d.smallStore, { userId: 'u1', requestId: 'r2', includedEditsPerMonth: 1, periodStart: period })).toMatchObject({ reason: 'already_used' })
    expect(d.small).toHaveLength(1)
  })
  it('never more than the database cap of 2, whatever the entitlement says', async () => {
    const d = db()
    for (const r of ['r1', 'r2', 'r3']) await recordIncludedEdit(d.smallStore, { userId: 'u1', requestId: r, includedEditsPerMonth: 5, periodStart: period })
    expect(d.small.map((r) => r.slot)).toEqual([1, 2])
  })
  it('the same request twice: "already counted", not a second slot', async () => {
    const d = db()
    await recordIncludedEdit(d.smallStore, { userId: 'u1', requestId: 'r1', includedEditsPerMonth: 2, periodStart: period })
    expect(await recordIncludedEdit(d.smallStore, { userId: 'u1', requestId: 'r1', includedEditsPerMonth: 2, periodStart: period })).toMatchObject({ reason: 'already_recorded' })
    expect(d.small).toHaveLength(1)
  })
  it('before the slot migration: falls back to the one-per-period table', async () => {
    const d = db({ noSlotColumn: true })
    expect(await recordIncludedEdit(d.smallStore, { userId: 'u1', requestId: 'r1', includedEditsPerMonth: 2, periodStart: period })).toEqual({ ok: true, slot: 1 })
    expect(await recordIncludedEdit(d.smallStore, { userId: 'u1', requestId: 'r2', includedEditsPerMonth: 2, periodStart: period })).toMatchObject({ reason: 'already_used' })
  })
})

// Oct 18: Big change counting removed with the retired add-on (big_change_uses table kept, no longer written).
