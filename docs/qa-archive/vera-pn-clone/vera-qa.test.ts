// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { memoryNotify } from './memory'
import { MemoryPickAlarm } from './alarm-memory'
import { CHANGE_DEBOUNCE_MS, fireChangeAlarm, idempotencyKey, onPickSaved, resendFailed, sendEvent } from './notify'
import { ITEMS, REQ_ID, item, request } from './fixtures'
import { suggestTemplates } from './score'
import { PickNotifyAlarm } from './do'

const T0 = new Date('2026-10-14T15:00:00Z')
const SL = [{ envato_item_id: 101, niche: 'plumbing_electrical', verify_status: 'confirmed', active: true }]
function setup(req = request(), items = ITEMS, alarm?: MemoryPickAlarm) {
  const m = memoryNotify({ items, now: T0, shortlist: SL, alarm })
  m.state.requests.set(req.id, req)
  return m
}
const adv = (s: { clock: { now: Date } }, ms: number) => { s.clock.now = new Date(s.clock.now.getTime() + ms) }
const out: Record<string, unknown> = {}

describe('vera qa', () => {
  it('T1 self-pick: one email, every field (client_purchase)', async () => {
    const { deps, state } = setup(request({ choice: 'client_purchase' }))
    await onPickSaved(deps, REQ_ID)
    expect(state.sent).toHaveLength(1)
    out.t1 = { subject: state.sent[0].subject, text: state.sent[0].text }
    for (const s of ['Request ID: ' + REQ_ID, 'Business: Rivera Plumbing', 'Type: Plumbing / electrical', 'Choice type: client_purchase', 'Author: demoauthor', 'HTML/WP: WordPress', 'On Elements: Yes', 'Price (customer buys): $59.00', 'Picked at: Oct 14, 2026, 10:00 AM CT', 'Window closes: Oct 14, 2026, 11:05 AM CT', 'ThemeForest: https://themeforest.net/item/x/101', 'Elements: https://elements.envato.com/web-templates?term='])
      expect(state.sent[0].text).toContain(s)
  })
  it('T2 alarm reset: 3 changes -> 1 email, latest state; first pick immediate', async () => {
    const { deps, state, alarm } = setup()
    await onPickSaved(deps, REQ_ID)
    expect(state.sent).toHaveLength(1) // immediate
    const fires: number[] = []
    for (const id of [102, 201, 102]) {
      adv(state, 30_000); state.requests.get(REQ_ID)!.envatoItemId = id
      await onPickSaved(deps, REQ_ID)
      fires.push(alarm.storage.get(REQ_ID)!.fireAt - state.clock.now.getTime())
    }
    expect(fires).toEqual([CHANGE_DEBOUNCE_MS, CHANGE_DEBOUNCE_MS, CHANGE_DEBOUNCE_MS])
    adv(state, CHANGE_DEBOUNCE_MS - 1)
    expect(alarm.takeDue(state.clock.now)).toHaveLength(0)
    adv(state, 1)
    const due = alarm.takeDue(state.clock.now)
    expect(due).toHaveLength(1)
    for (const a of due) await fireChangeAlarm(deps, a.requestId, a.pickVersion)
    expect(state.sent).toHaveLength(2)
    expect(state.sent[1].html).toContain('Pipeline Plumbing')
    expect(state.sent[1].idempotencyKey).toBe(idempotencyKey(REQ_ID, 'changed', 4))
  })
  it('T2b restart: new MemoryPickAlarm over same storage still fires', async () => {
    const storage = new Map()
    const a = setup(request(), ITEMS, new MemoryPickAlarm(storage))
    await onPickSaved(a.deps, REQ_ID); adv(a.state, 5000); await onPickSaved(a.deps, REQ_ID)
    const b = new MemoryPickAlarm(storage)
    expect(b.takeDue(new Date(a.state.clock.now.getTime() + CHANGE_DEBOUNCE_MS))).toHaveLength(1)
  })
  it('T2c DO: reset arriving while alarm() is sending is wiped by the trailing delete', async () => {
    const store = new Map<string, unknown>(); let alarmAt: number | null = null
    const storage = { get: async <T,>(k: string) => store.get(k) as T, put: async (k: string, v: unknown) => { store.set(k, v) }, delete: async (k: string) => store.delete(k), setAlarm: async (t: number) => { alarmAt = t }, deleteAlarm: async () => { alarmAt = null } }
    const m = setup()
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const realSend = m.deps.send
    m.deps.send = async (x) => { await gate; return realSend(x) }
    const doa = new PickNotifyAlarm({ storage }, undefined, async () => m.deps)
    const post = (b: object) => doa.fetch(new Request('https://x/', { method: 'POST', body: JSON.stringify({ requestId: REQ_ID, ...b }) }))
    await post({ op: 'reset', pickVersion: 2, fireAt: 1 })
    const running = doa.alarm()
    await new Promise((r) => setTimeout(r, 10))
    await post({ op: 'reset', pickVersion: 3, fireAt: 2 }) // a new change while the v2 email is in flight
    release(); await running
    out.t2c = { pendingAfter: store.get('pending') ?? null, alarmAt }
    await doa.alarm() // the v3 alarm fires
    out.t2c_sent = m.state.sent.map((s) => s.idempotencyKey)
  })
  it('T3 team pick hand-check + T3b empty notes', async () => {
    const { deps, state } = setup(request({ choice: 'team_pick', envatoItemId: null }))
    await onPickSaved(deps, REQ_ID)
    const s = (state.requests.get(REQ_ID)!.suggestions as { suggestions: { id: number; score: number; parts: unknown; general: boolean; reason: string }[] }).suggestions
    out.t3 = s.map((x) => ({ id: x.id, score: x.score, parts: x.parts, general: x.general, reason: x.reason }))
    out.t3text = state.sent[0].text
    const e = suggestTemplates(ITEMS, { type: 'plumbing_electrical', notes: '', shortlist: SL, now: T0 })
    out.t3empty = e.map((x) => ({ id: x.id, score: x.score, parts: x.parts, general: x.general }))
    const ws = suggestTemplates(ITEMS, { type: 'plumbing_electrical', notes: '   \n ', shortlist: SL, now: T0 })
    out.t3ws = ws.map((x) => x.parts.type)
    const stop = suggestTemplates(ITEMS, { type: 'plumbing_electrical', notes: 'the and for', shortlist: SL, now: T0 })
    out.t3stopwordsOnly = stop.map((x) => x.parts)
  })
  it('T4 under-3 and zero wording, always sends', async () => {
    const one = setup(request({ choice: 'team_pick', businessType: 'dental' }), [ITEMS[5], item({ id: 9, name: 'TF only dentist', autoNiches: ['dental'], onElements: false })])
    await onPickSaved(one.deps, REQ_ID)
    const zero = setup(request({ choice: 'team_pick', businessType: 'dental' }), [item({ id: 9, name: 'TF only dentist', autoNiches: ['dental'], onElements: false })])
    await onPickSaved(zero.deps, REQ_ID)
    out.t4 = { one: one.state.sent.length, oneText: one.state.sent[0]?.text, zero: zero.state.sent.length, zeroText: zero.state.sent[0]?.text, tfOnlyLeak: one.state.sent[0]?.html.includes('TF only') }
  })
  it('T5 failure keeps pick, logged, Send again no duplicate', async () => {
    const { deps, state } = setup()
    state.failSend = true
    await expect(onPickSaved(deps, REQ_ID)).resolves.toBeUndefined()
    const failed = await deps.log.listFailed()
    state.failSend = false
    const r1 = await resendFailed(deps, failed[0].id)
    const r2 = await resendFailed(deps, failed[0].id)
    const r3 = await sendEvent(deps, REQ_ID, 'picked', 1)
    out.t5 = { errors: state.errors, failed, r1, r2, r3, sent: state.sent.length, failedAfter: (await deps.log.listFailed()).length }
  })
  it('T6 replay same version none, new version sends', async () => {
    const { deps, state } = setup()
    await onPickSaved(deps, REQ_ID)
    const a = await sendEvent(deps, REQ_ID, 'picked', 1)
    const c1 = await fireChangeAlarm(deps, REQ_ID, 2)
    const c2 = await fireChangeAlarm(deps, REQ_ID, 2)
    const c3 = await fireChangeAlarm(deps, REQ_ID, 3)
    out.t6 = { a, c1, c2, c3, keys: state.sent.map((s) => s.idempotencyKey) }
  })
  it('T6b concurrent first saves (double submit)', async () => {
    const { deps, state } = setup()
    await Promise.all([onPickSaved(deps, REQ_ID), onPickSaved(deps, REQ_ID)])
    out.t6b = state.sent.map((s) => s.subject + ' ' + s.idempotencyKey)
  })
  it('T7 escaping', async () => {
    const evil = 'Bad\r\nBcc: x@evil.test <script>alert(1)</script>'
    const { deps, state } = setup(request({ businessName: evil, notes: '<img src=x onerror=alert(1)> plumber' }))
    await onPickSaved(deps, REQ_ID)
    const tp = setup(request({ choice: 'team_pick', businessName: evil, notes: '<b>plumber</b> repair "x"' }))
    await onPickSaved(tp.deps, REQ_ID)
    const m = state.sent[0]
    out.t7 = { subject: m.subject, subjectHasCRLF: /[\r\n]/.test(m.subject), rawScript: m.html.includes('<script'), escaped: m.html.includes('&lt;script&gt;'), onerror: m.html.includes('onerror'), tpSubject: tp.state.sent[0].subject, tpRawTag: /<script|<b>plumber/.test(tp.state.sent[0].html), textBcc: m.text.split('\n').filter((l) => /Bcc/.test(l)) }
  })
  it('dump', () => { require('node:fs').writeFileSync('/workspace/freeplug-qa/picker-notify-r1/vera-qa-results.json', JSON.stringify(out, null, 1)) })
})
