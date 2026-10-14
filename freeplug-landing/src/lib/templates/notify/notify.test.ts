// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { memoryNotify } from './memory'
import { CHANGE_DEBOUNCE_MS, idempotencyKey, onPickSaved, processDue } from './notify'
import { ITEMS, REQ_ID, item, request } from './fixtures'
import { shortlistPoints, suggestTemplates } from './score'
import { escapeHtml, headerSafe } from './escape'
import { savePickCore, type PickDeps } from '../pick'

const T0 = new Date('2026-10-14T15:00:00Z')
function setup(req = request(), items = ITEMS) {
  const m = memoryNotify({
    items, now: T0,
    shortlist: [
      { envato_item_id: 101, niche: 'plumbing_electrical', verify_status: 'confirmed', active: true },
      { envato_item_id: 202, niche: 'hvac', verify_status: 'confirmed', active: true },
    ],
  })
  m.state.requests.set(req.id, req)
  return m
}
const advance = (s: { clock: { now: Date } }, ms: number) => { s.clock.now = new Date(s.clock.now.getTime() + ms) }

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
    // body order: title, details, links last
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

  it('3 changes inside the window produce exactly 1 debounced follow-up, ~2 min after the last', async () => {
    const { deps, state } = setup()
    await onPickSaved(deps, REQ_ID)
    for (const id of [102, 101, 102]) {
      advance(state, 30_000)
      state.requests.get(REQ_ID)!.envatoItemId = id
      await onPickSaved(deps, REQ_ID)
    }
    expect(state.sent).toHaveLength(1)
    const pending = state.queue.filter((q) => q.event === 'changed')
    expect(pending).toHaveLength(1)
    expect(Date.parse(pending[0].dueAt)).toBe(state.clock.now.getTime() + CHANGE_DEBOUNCE_MS)
    advance(state, CHANGE_DEBOUNCE_MS - 1000)
    await processDue(deps)
    expect(state.sent).toHaveLength(1)
    advance(state, 1000)
    await processDue(deps)
    await processDue(deps)
    expect(state.sent).toHaveLength(2)
    expect(state.sent[1].subject).toBe(`Template changed: Rivera Plumbing (request ${REQ_ID})`)
    expect(state.sent[1].html).toContain('Pipeline Plumbing') // the latest pick
    expect(state.sent[1].idempotencyKey).toBe(idempotencyKey(REQ_ID, 'changed', 4))
  })

  it('debounce survives a restart: a fresh processor on the same queue sends the due change', async () => {
    const { deps, state } = setup()
    await onPickSaved(deps, REQ_ID)
    advance(state, 10_000)
    await onPickSaved(deps, REQ_ID)
    // "restart": new deps/process, same persisted requests + queue
    const r = memoryNotify({ items: ITEMS })
    r.state.requests = state.requests
    r.state.queue = state.queue
    r.state.clock.now = new Date(state.clock.now.getTime() + CHANGE_DEBOUNCE_MS)
    await processDue(r.deps)
    expect(r.state.sent.map((s) => s.subject)).toEqual([`Template changed: Rivera Plumbing (request ${REQ_ID})`])
  })
})

describe('team pick suggestions', () => {
  it('top 3 by score, all on Elements, general fill marked, stored for audit', async () => {
    const { deps, state } = setup(request({ choice: 'team_pick', envatoItemId: null }))
    await onPickSaved(deps, REQ_ID)
    expect(state.sent).toHaveLength(1)
    const m = state.sent[0]
    expect(m.subject).toBe(`Team pick suggestions: Rivera Plumbing (request ${REQ_ID})`)
    const audit = state.requests.get(REQ_ID)!.suggestions as { suggestions: { id: number; score: number; general: boolean; reason: string }[] }
    const s = audit.suggestions
    expect(s).toHaveLength(3)
    expect(s.map((x) => x.id)).not.toContain(103) // ThemeForest-only, never
    expect(s.slice(0, 2).every((x) => !x.general)).toBe(true)
    expect(s[0].id).toBe(101)
    expect(s[0].score).toBeGreaterThan(s[1].score)
    expect(s[0].reason).toBe("Matches 'plumber'; 4 service keywords overlap; on Lina's shortlist.")
    expect(s[2].general).toBe(true)
    expect(s[2].reason).toMatch(/^General local-business template; no match for 'plumbing electrical'\./)
    expect(m.html).toContain(`${s[0].score}/100`)
    expect(m.html).toContain('>General</span>')
    expect(m.html.indexOf(`${s[0].score}/100`)).toBeLessThan(m.html.indexOf(`${s[1].score}/100`))
  })

  it('score parts are deterministic and capped at 100', () => {
    const input = { type: 'plumbing_electrical' as const, services: [], notes: 'plumber repair heater', shortlist: [], now: T0 }
    const a = suggestTemplates(ITEMS, input)
    expect(suggestTemplates([...ITEMS].reverse(), input)).toEqual(a)
    for (const x of a) expect(x.score).toBeLessThanOrEqual(100)
  })

  it('shortlist points only for the request\'s own type (no fallback)', () => {
    const rows = [{ envato_item_id: 5, niche: 'hvac', verify_status: 'confirmed', active: true }]
    expect(shortlistPoints(5, 'hvac', rows)).toBe(15)
    expect(shortlistPoints(5, 'plumbing_electrical', rows)).toBe(0)
    expect(shortlistPoints(5, 'hvac', [{ ...rows[0], verify_status: 'cut' }])).toBe(0)
  })

  it('fewer than 3 eligible still sends', async () => {
    const { deps, state } = setup(request({ choice: 'team_pick', businessType: 'dental' }), [ITEMS[5], item({ id: 9, name: 'TF only', autoNiches: [], onElements: false })])
    await onPickSaved(deps, REQ_ID)
    expect(state.sent).toHaveLength(1)
    expect(state.sent[0].html).toContain('Only 1 eligible Elements template found.')
    expect(state.sent[0].html).not.toContain('TF only')
  })
})

describe('failures, idempotency, escaping', () => {
  it('a failed send does not break the pick, is logged, alerted and retried with the same key', async () => {
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
    expect(state.alerts.join()).toMatch(/failed for request/)
    expect(state.queue[0].attempts).toBe(1)
    state.failSend = false
    await processDue(deps)
    expect(state.sent).toHaveLength(1)
    expect(state.sent[0].idempotencyKey).toBe(idempotencyKey(REQ_ID, 'picked', 1))
  })

  it('a throwing store never escapes onPickSaved', async () => {
    const { deps, state } = setup()
    deps.bumpVersion = async () => { throw new Error('db down') }
    await expect(onPickSaved(deps, REQ_ID)).resolves.toBeUndefined()
    expect(state.alerts[0]).toMatch(/could not be queued/)
  })

  it('idempotency: re-running and re-enqueueing the same version sends once', async () => {
    const { deps, state } = setup()
    await onPickSaved(deps, REQ_ID)
    await deps.enqueue({ requestId: REQ_ID, event: 'picked', pickVersion: 1, dueAt: T0.toISOString() })
    await processDue(deps)
    await processDue(deps)
    expect(state.sent).toHaveLength(1)
    expect(state.queue.filter((q) => q.event === 'picked')).toHaveLength(1)
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
