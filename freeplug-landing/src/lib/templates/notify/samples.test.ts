// @vitest-environment node
import { describe, it } from 'vitest'
import { memoryNotify } from './memory'
import { fireChangeAlarm, onPickSaved, type NotifyDeps } from './notify'
import { writeOutbox } from './outbox'
import { ITEMS, REQ_ID, request } from './fixtures'
import { CHANGE_DEBOUNCE_MS } from './notify'

/** Writes the sample emails into the outbox. Runs only with NOTIFY_SAMPLES_DIR set (skipped in the suite). */
const dir = process.env.NOTIFY_SAMPLES_DIR
describe.skipIf(!dir)('notify outbox samples', () => {
  it('writes self-pick, debounced change, team pick (general fill), under-3, zero matches', async () => {
    const run = async (req: ReturnType<typeof request>, items = ITEMS, f?: (d: NotifyDeps, s: ReturnType<typeof memoryNotify>['state'], a: ReturnType<typeof memoryNotify>['alarm']) => Promise<void>) => {
      const m = memoryNotify({ items, shortlist: [{ envato_item_id: 101, niche: 'plumbing_electrical', verify_status: 'confirmed', active: true }] })
      m.deps.send = (mail) => writeOutbox(mail, 'email', dir!)
      m.state.requests.set(req.id, req)
      await onPickSaved(m.deps, req.id)
      if (f) await f(m.deps, m.state, m.alarm)
    }
    await run(request({ choice: 'envato_catalog' }), ITEMS, async (d, s, a) => {
      for (const id of [102, 101, 102]) {
        s.clock.now = new Date(s.clock.now.getTime() + 20_000)
        s.requests.get(REQ_ID)!.envatoItemId = id
        await onPickSaved(d, REQ_ID)
      }
      s.clock.now = new Date(s.clock.now.getTime() + CHANGE_DEBOUNCE_MS)
      for (const x of a.takeDue(s.clock.now)) await fireChangeAlarm(d, x.requestId, x.pickVersion)
    })
    await run(request({ id: '22222222-2222-4333-8444-555555555555', businessName: 'Rivera Plumbing', choice: 'team_pick', envatoItemId: null }))
    await run(request({ id: '44444444-2222-4333-8444-555555555555', businessName: 'Grace Church', businessType: 'church', choice: 'team_pick', envatoItemId: null, notes: '' }), [])
    await run(request({ id: '33333333-2222-4333-8444-555555555555', businessName: 'Smile Dental <b>Co</b>', businessType: 'dental', choice: 'team_pick', envatoItemId: null }), [ITEMS[5]])
  })
})
