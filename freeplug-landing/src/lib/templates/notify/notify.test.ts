// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { memoryNotify } from './memory'
import { MemoryPickAlarm } from './alarm-memory'
import { CHANGE_DEBOUNCE_MS, fireChangeAlarm, idempotencyKey, onPickSaved, resendFailed, sendEvent } from './notify'
import { PickNotifyAlarm, type DoState } from './do'
import { ITEMS, REQ_ID, item, request } from './fixtures'
import { SCORE, shortlistPoints, suggestTemplates } from './score'
import { escapeHtml, headerSafe } from './escape'
import { shortfallLine } from './emails'
import { savePickCore, type PickDeps } from '../pick'

const T0 = new Date('2026-10-14T15:00:00Z')
function setup(req = request(), items = ITEMS, alarm?: MemoryPickAlarm) {
  const m = memoryNotify({
    items, now: T0, alarm,
    shortlist: [
      { envato_item_id: 101, niche: 'plumbing_electrical', verify_status: 'confirmed', active: true },
      { envato_item_id: 202, niche: 'hvac', verify_status: 'confirmed', active: true },
    ],
  })
  m.state.requests.set(req.id, req)
  return m
}
const advance = (s: { clock: { now: Date } }, ms: number) => { s.clock.now = new Date(s.clock.now.getTime() + ms) }
async function fireDue(m: ReturnType<typeof setup>, force = false) {
  for (const a of m.alarm.takeDue(m.state.clock.now, force)) await fireChangeAlarm(m.deps, a.requestId, a.pickVersion)
}

describe('self-pick notify', () => {
  it('sends ONE email with every field', async () => {
    const { deps, state } = setup(request({ choice: 'client_purchase' }))
    await onPickSaved(deps, REQ_ID)
    expect(state.sent).toHaveLength(1)
    const m = state.sent[0]
    expect(m.to).toBe('admin@example.test')
    expect(m.subject).toBe(`Template picked: Rivera Plumbing (request ${REQ_ID})`)
    for (const s of [REQ_ID, 'Rivera Plumbing', 'Plumbing / electrical', 'client_purchase', 'Plumbex - Plumber &amp; Water Heater Repair WordPress Theme',
      'demoauthor', 'WordPress', 'https://themeforest.net/item/x/101', 'https://elements.envato.com/web-templates?term=', 'On Elements:</span> Yes',
      '$59.00', 'Oct 14, 2026, 10:00 AM CT', 'Oct 14, 2026, 11:05 AM CT', 'https://s3.envato.com/preview/101.jpg']) {
      expect(m.html).toContain(s)
    }
    expect(m.html.indexOf('Plumbex')).toBeLessThan(m.html.indexOf('Business:'))
    expect(m.html.lastIndexOf('Business:')).toBeLessThan(m.html.indexOf('>ThemeForest<'))
    expect(m.html.indexOf('>ThemeForest<')).toBeLessThan(m.html.indexOf('>Elements<'))
    expect(m.html).toContain('max-width:600px')
    expect(m.html).not.toMatch(/<style|<link/i)
    expect(m.idempotencyKey).toBe(idempotencyKey(REQ_ID, 'picked', 1))
  })

  it('price only appears for customer-buys', async () => {
    const { deps, state } = setup()
    await onPickSaved(deps, REQ_ID)
    expect(state.sent[0].html).not.toContain('Price (customer buys)')
  })

  it('the alarm resets to now + 2 min on every change', async () => {
    const m = setup()
    await onPickSaved(m.deps, REQ_ID)
    expect(m.alarm.pending()).toHaveLength(0)
    for (let i = 0; i < 3; i++) {
      advance(m.state, 30_000)
      await onPickSaved(m.deps, REQ_ID)
      const p = m.alarm.pending()
      expect(p).toHaveLength(1)
      expect(Date.parse(p[0].fireAt)).toBe(m.state.clock.now.getTime() + CHANGE_DEBOUNCE_MS)
      expect(p[0].pickVersion).toBe(i + 2)
    }
  })

  it('3 changes send exactly 1 follow-up with the latest state', async () => {
    const m = setup()
    await onPickSaved(m.deps, REQ_ID)
    for (const id of [102, 101, 102]) {
      advance(m.state, 30_000)
      m.state.requests.get(REQ_ID)!.envatoItemId = id
      await onPickSaved(m.deps, REQ_ID)
      await fireDue(m)
    }
    expect(m.state.sent).toHaveLength(1)
    advance(m.state, CHANGE_DEBOUNCE_MS - 1000)
    await fireDue(m)
    expect(m.state.sent).toHaveLength(1)
    advance(m.state, 1000)
    await fireDue(m)
    await fireDue(m)
    expect(m.state.sent).toHaveLength(2)
    expect(m.state.sent[1].subject).toBe(`Template changed: Rivera Plumbing (request ${REQ_ID})`)
    expect(m.state.sent[1].html).toContain('Pipeline Plumbing')
    expect(m.state.sent[1].idempotencyKey).toBe(idempotencyKey(REQ_ID, 'changed', 4))
  })

  it('the follow-up survives a restart (alarm storage is durable)', async () => {
    const storage = new Map()
    const a = setup(request(), ITEMS, new MemoryPickAlarm(storage))
    await onPickSaved(a.deps, REQ_ID)
    advance(a.state, 10_000)
    await onPickSaved(a.deps, REQ_ID)
    // restart: new process + alarm object over the same durable storage / request + log rows
    const b = setup(request(), ITEMS, new MemoryPickAlarm(storage))
    b.state.requests = a.state.requests
    b.state.log = a.state.log
    b.state.clock.now = new Date(a.state.clock.now.getTime() + CHANGE_DEBOUNCE_MS)
    await fireDue(b)
    expect(b.state.sent.map((s) => s.subject)).toEqual([`Template changed: Rivera Plumbing (request ${REQ_ID})`])
  })

  it('Durable Object: reset replaces the alarm, alarm() sends once with the latest version', async () => {
    const store = new Map<string, unknown>()
    let alarmAt: number | null = null
    const st: DoState = { storage: {
      get: async <T,>(k: string) => store.get(k) as T | undefined,
      put: async (k, v) => { store.set(k, v) },
      delete: async (k) => store.delete(k),
      setAlarm: async (t) => { alarmAt = t },
      deleteAlarm: async () => { alarmAt = null },
    } }
    const m = setup()
    await onPickSaved(m.deps, REQ_ID)
    const dobj = new PickNotifyAlarm(st, {}, async () => m.deps)
    const post = (b: object) => dobj.fetch(new Request('https://x/', { method: 'POST', body: JSON.stringify({ requestId: REQ_ID, ...b }) }))
    expect((await post({ op: 'reset', pickVersion: 2, fireAt: 1000 })).status).toBe(200)
    expect((await post({ op: 'reset', pickVersion: 3, fireAt: 2000 })).status).toBe(200)
    expect(alarmAt).toBe(2000)
    // a new DO instance over the same storage (eviction / restart) still fires
    const again = new PickNotifyAlarm(st, {}, async () => m.deps)
    await again.alarm()
    await again.alarm()
    expect(m.state.sent).toHaveLength(2)
    expect(m.state.sent[1].idempotencyKey).toBe(idempotencyKey(REQ_ID, 'changed', 3))
    expect((await post({ op: 'cancel' })).status).toBe(200)
    expect(alarmAt).toBeNull()
  })

  it('switching to team pick cancels a pending change alarm', async () => {
    const m = setup()
    await onPickSaved(m.deps, REQ_ID)
    await onPickSaved(m.deps, REQ_ID)
    expect(m.alarm.pending()).toHaveLength(1)
    m.state.requests.get(REQ_ID)!.choice = 'team_pick'
    await onPickSaved(m.deps, REQ_ID)
    expect(m.alarm.pending()).toHaveLength(0)
  })
})

describe('team pick suggestions', () => {
  it('top 3 by score, all on Elements, general fill marked, stored for audit', async () => {
    const { deps, state } = setup(request({ choice: 'team_pick', envatoItemId: null }))
    await onPickSaved(deps, REQ_ID)
    expect(state.sent).toHaveLength(1)
    const m = state.sent[0]
    expect(m.subject).toBe(`Team pick suggestions: Rivera Plumbing (request ${REQ_ID})`)
    const s = (state.requests.get(REQ_ID)!.suggestions as { suggestions: { id: number; score: number; general: boolean; reason: string }[] }).suggestions
    expect(s).toHaveLength(3)
    expect(s.map((x) => x.id)).not.toContain(103)
    expect(s.slice(0, 2).every((x) => !x.general)).toBe(true)
    expect(s[0].id).toBe(101)
    expect(s[0].score).toBeGreaterThan(s[1].score)
    expect(s[0].reason).toBe("Matches 'plumber'; 4 notes keywords overlap; on Lina's shortlist.")
    expect(s[2].general).toBe(true)
    expect(s[2].reason).toMatch(/^General local-business template; no match for 'plumbing electrical'\./)
    expect(m.html).toContain(`${s[0].score}/100`)
    expect(m.html).toContain('>General</span>')
    expect(m.html).not.toContain('Lina will hand-pick')
  })

  it('deterministic and capped at 100', () => {
    const input = { type: 'plumbing_electrical' as const, notes: 'plumber repair heater', shortlist: [], now: T0 }
    const a = suggestTemplates(ITEMS, input)
    expect(suggestTemplates([...ITEMS].reverse(), input)).toEqual(a)
    for (const x of a) expect(x.score).toBeLessThanOrEqual(100)
  })

  it('needs-fit scores from notes only; empty notes move its 25 points to type match (65)', () => {
    const base = { type: 'plumbing_electrical' as const, shortlist: [], now: T0 }
    const withNotes = suggestTemplates(ITEMS, { ...base, notes: 'water heater repair' })
    expect(withNotes[0].parts.type).toBe(40)
    expect(withNotes[0].parts.keywords).toBeGreaterThan(0)
    for (const notes of [null, '', '   ']) {
      const s = suggestTemplates(ITEMS, { ...base, notes })
      expect(s[0].parts.type).toBe(SCORE.typeNoNotes)
      expect(SCORE.typeNoNotes).toBe(65)
      expect(s.every((x) => x.parts.keywords === 0)).toBe(true)
      expect(s.filter((x) => x.general).every((x) => x.parts.type === 0)).toBe(true)
    }
  })

  it("shortlist points only for the request's own type (no fallback)", () => {
    const rows = [{ envato_item_id: 5, niche: 'hvac', verify_status: 'confirmed', active: true }]
    expect(shortlistPoints(5, 'hvac', rows)).toBe(15)
    expect(shortlistPoints(5, 'plumbing_electrical', rows)).toBe(0)
    expect(shortlistPoints(5, 'hvac', [{ ...rows[0], verify_status: 'cut' }])).toBe(0)
  })

  it('fewer than 3 Elements matches still sends, with the hand-pick line', async () => {
    const { deps, state } = setup(request({ choice: 'team_pick', businessType: 'dental' }), [ITEMS[5], item({ id: 9, name: 'TF only', autoNiches: [], onElements: false })])
    await onPickSaved(deps, REQ_ID)
    expect(state.sent).toHaveLength(1)
    expect(state.sent[0].html).toContain('Only 1 Elements match for &#39;Dental&#39;. Lina will hand-pick the rest.')
    expect(state.sent[0].text).toContain("Only 1 Elements match for 'Dental'. Lina will hand-pick the rest.")
    expect(state.sent[0].html).not.toContain('TF only')
  })

  it('shortfall copy: 0, 1 (singular), 2, and none at 3', () => {
    expect(shortfallLine(0, 'HVAC')).toBe("No Elements matches for 'HVAC'. Lina will hand-pick suggestions.")
    expect(shortfallLine(1, 'HVAC')).toBe("Only 1 Elements match for 'HVAC'. Lina will hand-pick the rest.")
    expect(shortfallLine(2, 'HVAC')).toBe("Only 2 Elements matches for 'HVAC'. Lina will hand-pick the rest.")
    expect(shortfallLine(3, 'HVAC')).toBe('')
  })

  it('0 Elements matches still sends an email', async () => {
    const { deps, state } = setup(request({ choice: 'team_pick', businessType: 'church' }), [item({ id: 9, name: 'TF only', onElements: false })])
    await onPickSaved(deps, REQ_ID)
    expect(state.sent).toHaveLength(1)
    expect(state.sent[0].text).toContain("No Elements matches for 'Church'. Lina will hand-pick suggestions.")
  })
})

describe('failures, idempotency, escaping', () => {
  it('a failed send does not break the pick, is logged as failed (no alert email) and can be sent again', async () => {
    const { deps, state } = setup()
    state.failSend = true
    const pickDeps: PickDeps = {
      userId: async () => 'u1',
      loadRequest: async () => ({ id: REQ_ID, user_id: 'u1', status: 'submitted', business_type: 'plumbing_electrical', template_locked_at: null, template_choice: null, template_first_picked_at: null }),
      lookupItem: async () => ({ id: 101, name: 'x', previewImageUrl: null, livePreviewUrl: null, url: null, autoNiches: ['plumbing_electrical'], lastSeenAt: T0.toISOString(), status: 'active' }),
      loadWiden: async () => null, findWidens: async () => [],
      write: async () => true, now: () => T0,
    }
    const res = await savePickCore(pickDeps, REQ_ID, { choice: 'envato_catalog', envatoItemId: 101 })
    await expect(onPickSaved(deps, REQ_ID)).resolves.toBeUndefined()
    expect(res).toEqual({ ok: true })
    expect(state.sent).toHaveLength(0)
    expect(state.errors.join()).toMatch(/send failed/)
    const failed = await deps.log.listFailed()
    expect(failed).toHaveLength(1)
    expect(failed[0].attempts).toBe(1)
    state.failSend = false
    expect(await resendFailed(deps, failed[0].id)).toBe('sent')
    expect(state.sent[0].idempotencyKey).toBe(idempotencyKey(REQ_ID, 'picked', 1))
    expect(await deps.log.listFailed()).toHaveLength(0)
    expect(await resendFailed(deps, failed[0].id)).toBe('skipped')
  })

  it('a throwing store never escapes onPickSaved', async () => {
    const { deps, state } = setup()
    deps.bumpVersion = async () => { throw new Error('db down') }
    await expect(onPickSaved(deps, REQ_ID)).resolves.toBeUndefined()
    expect(state.errors[0]).toMatch(/notify failed/)
  })

  it('idempotency: the same request + event + version sends once', async () => {
    const { deps, state } = setup()
    await onPickSaved(deps, REQ_ID)
    expect(await sendEvent(deps, REQ_ID, 'picked', 1)).toBe('skipped')
    await fireChangeAlarm(deps, REQ_ID, 2)
    await fireChangeAlarm(deps, REQ_ID, 2)
    expect(state.sent).toHaveLength(2)
  })

  it('business name with a newline and <script> is escaped in the body and single-line in the subject', async () => {
    const evil = 'Bad\r\nBcc: x@evil.test <script>alert(1)</script>'
    const { deps, state } = setup(request({ businessName: evil, notes: '<img src=x onerror=alert(1)>' }))
    await onPickSaved(deps, REQ_ID)
    const m = state.sent[0]
    expect(m.subject).not.toMatch(/[\r\n]/)
    expect(m.subject).toBe(`Template picked: Bad Bcc: x@evil.test <script>alert(1)</script> (request ${REQ_ID})`)
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(m.html).not.toContain('onerror=alert')
    expect(m.text.split('\n').some((l) => l.startsWith('Bcc:'))).toBe(false)
  })

  it('team pick card escapes HTML in template titles too', async () => {
    const { deps, state } = setup(request({ choice: 'team_pick', businessName: 'A<b>' }), [item({ id: 7, name: 'Plumber <i>x</i>', autoNiches: ['plumbing_electrical'] })])
    await onPickSaved(deps, REQ_ID)
    expect(state.sent[0].html).toContain('Plumber &lt;i&gt;x&lt;/i&gt;')
    expect(state.sent[0].html).toContain('A&lt;b&gt;')
  })

  it('escape helpers', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;')
    expect(headerSafe('a\r\nb\tc')).toBe('a b c')
  })
})
