import { describe, expect, it } from 'vitest'
import { recordBigChange, recordIncludedEdit, type BigChangeStore, type IncludedEditStore } from './included-edits'

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
  const bigStore: BigChangeStore = {
    async insertUse(row) {
      if (small.some((r) => r.request_id === row.request_id)) return { code: 'FP409', message: 'This request is already counted as a small edit.' }
      if (big.some((r) => r.request_id === row.request_id)) return dup('big_change_uses_request_id_key')
      if (big.some((r) => r.user_id === row.user_id && r.period_start === row.period_start)) return dup('big_change_uses_user_period_key')
      big.push(row)
      return null
    },
  }
  return { small, big, smallStore, bigStore }
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

describe('Big change counting (one a period, never also a small edit)', () => {
  const mark = (d: ReturnType<typeof db>, requestId: string, at = period, n = 1) => recordBigChange(d.bigStore, { userId: 'u1', requestId, bigChangesPerMonth: n, periodStart: at })
  it('one a period; next period allowed', async () => {
    const d = db()
    expect(await mark(d, 'r1')).toEqual({ ok: true })
    expect(await mark(d, 'r2')).toMatchObject({ ok: false, reason: 'already_used' })
    expect(await mark(d, 'r3', next)).toEqual({ ok: true })
  })
  it('needs the add-on and a known period (nothing written)', async () => {
    const d = db()
    expect(await mark(d, 'r1', period, 0)).toMatchObject({ reason: 'not_included' })
    expect(await recordBigChange(d.bigStore, { userId: 'u1', requestId: 'r1', bigChangesPerMonth: 1, periodStart: null })).toMatchObject({ reason: 'no_period' })
    expect(d.big).toEqual([])
  })
  it('a request is counted in one table only, both directions', async () => {
    const d = db()
    await recordIncludedEdit(d.smallStore, { userId: 'u1', requestId: 'r1', includedEditsPerMonth: 1, periodStart: period })
    expect(await mark(d, 'r1')).toMatchObject({ ok: false, reason: 'counted_elsewhere' })
    expect(await mark(d, 'r2')).toEqual({ ok: true })
    expect(await recordIncludedEdit(d.smallStore, { userId: 'u1', requestId: 'r2', includedEditsPerMonth: 2, periodStart: next })).toMatchObject({ ok: false, reason: 'counted_elsewhere' })
  })
})
