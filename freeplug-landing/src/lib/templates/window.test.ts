import { describe, expect, it, vi } from 'vitest'
import { changeBusinessTypeCore, savePickCore, type PickDeps, type PickRequestRow } from './pick'
import { isPickWindowOpen, pickCountdownMinutes, PICK_WINDOW_DISPLAY_MIN, PICK_WINDOW_SERVER_MIN, unlockUntil } from './window'
import { changeRequestMailto, countdownText } from './copy'

/** Mocked clock: FIRST is the first pick; at(m, s) is m:s after it. */
const FIRST = new Date('2026-10-13T20:00:00Z')
const at = (m: number, s = 0) => new Date(FIRST.getTime() + (m * 60 + s) * 1000)
const RID = '00000000-0000-4000-8000-00000000c0de'
const OWNER = 'owner-uid'

function deps(row: Partial<PickRequestRow>, clock: { now: Date }) {
  let req: PickRequestRow = { id: RID, user_id: OWNER, status: 'submitted', business_type: 'cleaning', template_locked_at: null, template_choice: 'team_pick', template_first_picked_at: FIRST.toISOString(), template_unlocked_until: null, ...row }
  const write = vi.fn(async (_id: string, patch: Record<string, unknown>) => { req = { ...req, ...patch } as PickRequestRow; return true })
  const d: PickDeps = {
    userId: async () => OWNER,
    loadRequest: async () => req,
    lookupItem: async () => null,
    loadWiden: async () => null,
    findWidens: async () => [],
    write,
    now: async () => clock.now,
  }
  return { d, write, row: () => req }
}
const pick = (d: PickDeps) => savePickCore(d, RID, { choice: 'team_pick' })

describe('pick window constants', () => {
  it('customer sees 60, server allows 65', () => {
    expect(PICK_WINDOW_DISPLAY_MIN).toBe(60)
    expect(PICK_WINDOW_SERVER_MIN).toBe(65)
  })
})

describe('savePickCore with the window (mocked clock)', () => {
  it('first pick sets template_first_picked_at once', async () => {
    const clock = { now: FIRST }
    const { d, write } = deps({ template_choice: null, template_first_picked_at: null }, clock)
    expect(await pick(d)).toEqual({ ok: true })
    expect(write.mock.calls[0][1]).toMatchObject({ template_first_picked_at: FIRST.toISOString(), template_picked_at: FIRST.toISOString() })
  })
  it('accepted at 59 and the countdown says 1 more minute', async () => {
    const clock = { now: at(59) }
    const { d, row } = deps({}, clock)
    expect(pickCountdownMinutes(row(), clock.now)).toBe(1)
    expect(countdownText('en', 1)).toBe('You can change your template for 1 more minute.')
    expect(await pick(d)).toEqual({ ok: true })
  })
  it('accepted at 61 (silent grace, no countdown)', async () => {
    const clock = { now: at(61) }
    const { d, row } = deps({}, clock)
    expect(pickCountdownMinutes(row(), clock.now)).toBeNull()
    expect(await pick(d)).toEqual({ ok: true })
  })
  it('accepted at 64:59, rejected at 65:01', async () => {
    expect(await pick(deps({}, { now: at(64, 59) }).d)).toEqual({ ok: true })
    const { d, write } = deps({}, { now: at(65, 1) })
    expect(await pick(d)).toEqual({ ok: false, error: 'locked' })
    expect(write).not.toHaveBeenCalled()
  })
  it('re-pick at 62 is accepted and does not move the 65-minute deadline', async () => {
    const clock = { now: at(62) }
    const { d, write, row } = deps({}, clock)
    expect(await savePickCore(d, RID, { choice: 'client_pasted', pastedUrl: 'https://themeforest.net/item/x/1' })).toEqual({ ok: true })
    expect(write.mock.calls[0][1]).not.toHaveProperty('template_first_picked_at')
    expect(row().template_first_picked_at).toBe(FIRST.toISOString())
    clock.now = at(65, 1)
    expect(await pick(d)).toEqual({ ok: false, error: 'locked' })
  })
  it('business_type change rejected after the window, accepted inside it', async () => {
    expect(await changeBusinessTypeCore(deps({}, { now: at(30) }).d, RID, 'dental')).toEqual({ ok: true, cleared: false })
    const { d, write } = deps({}, { now: at(65, 1) })
    expect(await changeBusinessTypeCore(d, RID, 'dental')).toEqual({ ok: false, error: 'locked' })
    expect(write).not.toHaveBeenCalled()
  })
})

describe('admin unlock', () => {
  it('lasts 65 minutes from the db clock, then expires', async () => {
    const unlockAt = at(200)
    const until = unlockUntil(unlockAt)
    expect(until.getTime() - unlockAt.getTime()).toBe(65 * 60_000)
    const row = { template_unlocked_until: until.toISOString() }
    expect(await pick(deps(row, { now: at(200 + 64, 59) }).d)).toEqual({ ok: true })
    expect(await pick(deps(row, { now: at(200 + 65, 1) }).d)).toEqual({ ok: false, error: 'locked' })
  })
  it('countdown during an unlock runs to its 60-minute mark, then hides', () => {
    const r = { status: 'submitted', template_locked_at: null, template_first_picked_at: FIRST.toISOString(), template_unlocked_until: unlockUntil(at(200)).toISOString() }
    expect(pickCountdownMinutes(r, at(200))).toBe(60)
    expect(pickCountdownMinutes(r, at(261))).toBeNull()
    expect(isPickWindowOpen(r, at(261))).toBe(true)
  })
  it('locked beats unlock', async () => {
    const row = { template_unlocked_until: unlockUntil(at(10)).toISOString(), template_locked_at: at(5).toISOString() }
    expect(await pick(deps(row, { now: at(11) }).d)).toEqual({ ok: false, error: 'locked' })
  })
})

describe('countdown', () => {
  const r = { status: 'submitted', template_locked_at: null, template_first_picked_at: FIRST.toISOString() }
  it('rounds up and never shows 0', () => {
    expect(pickCountdownMinutes(r, at(0))).toBe(60)
    expect(pickCountdownMinutes(r, at(0, 1))).toBe(60)
    expect(pickCountdownMinutes(r, at(58, 30))).toBe(2)
    expect(pickCountdownMinutes(r, at(59, 59))).toBe(1)
    expect(pickCountdownMinutes(r, at(60))).toBeNull()
  })
  it('hidden before the first pick and after the window', () => {
    expect(pickCountdownMinutes({ ...r, template_first_picked_at: null }, at(0))).toBeNull()
    expect(pickCountdownMinutes(r, at(66))).toBeNull()
  })
  it('plural keys in both languages', () => {
    expect(countdownText('en', 12)).toBe('You can change your template for 12 more minutes.')
    expect(countdownText('es', 1)).toBe('Puedes cambiar tu plantilla durante 1 minuto más.')
    expect(countdownText('es', 12)).toBe('Puedes cambiar tu plantilla durante 12 minutos más.')
  })
})

describe('change-request mailto (Vera test 6)', () => {
  it('EN and ES subjects are encodeURIComponent-encoded, accents and comma included', () => {
    const en = changeRequestMailto('en', RID)
    const es = changeRequestMailto('es', RID)
    expect(en).toBe(`mailto:support@freeplug-in.dev?subject=Template%20change%2C%20request%20${RID}`)
    expect(es).toBe(`mailto:support@freeplug-in.dev?subject=Cambio%20de%20plantilla%2C%20solicitud%20${RID}`)
    expect(decodeURIComponent(es.split('subject=')[1])).toBe(`Cambio de plantilla, solicitud ${RID}`)
  })
})
