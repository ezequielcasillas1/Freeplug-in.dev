import { describe, expect, it, vi } from 'vitest'
import { isFresh, type CatalogCard } from './catalog-lookup'
import { isPickEditable, isValidPastedUrl, savePickCore, widenApplies, type PickDeps, type PickRequestRow, type WidenRow } from './pick'

const NOW = new Date('2026-10-12T20:00:00Z')
const RID = '00000000-0000-4000-8000-00000000c0de'
const OWNER = 'owner-uid'
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()

function item(over: Partial<CatalogCard> = {}): CatalogCard {
  return { id: 101, name: 'Sparkle', previewImageUrl: null, livePreviewUrl: null, url: null, autoNiches: ['cleaning'], lastSeenAt: hoursAgo(1), status: 'active', ...over }
}

function deps(opts: { uid?: string | null; req?: Partial<PickRequestRow> | null; item?: CatalogCard | null; widen?: WidenRow | null; write?: boolean } = {}) {
  const req: PickRequestRow | null =
    opts.req === null ? null : { id: RID, user_id: OWNER, status: 'submitted', business_type: 'cleaning', template_locked_at: null, ...opts.req }
  const write = vi.fn(async () => opts.write ?? true)
  const d: PickDeps = {
    userId: async () => (opts.uid === undefined ? OWNER : opts.uid),
    loadRequest: async () => req,
    lookupItem: async () => (opts.item === undefined ? item() : opts.item),
    loadWiden: async () => opts.widen ?? null,
    write,
    now: () => NOW,
  }
  return { d, write }
}

describe('savePickCore: who may write', () => {
  it('refuses anonymous (no session) without touching the DB', async () => {
    const { d, write } = deps({ uid: null })
    expect(await savePickCore(d, RID, { choice: 'team_pick' })).toEqual({ ok: false, error: 'save' })
    expect(write).not.toHaveBeenCalled()
  })
  it("refuses another user's request", async () => {
    const { d, write } = deps({ uid: 'someone-else' })
    expect(await savePickCore(d, RID, { choice: 'team_pick' })).toEqual({ ok: false, error: 'save' })
    expect(write).not.toHaveBeenCalled()
  })
  it('refuses a missing request and a malformed id', async () => {
    expect((await savePickCore(deps({ req: null }).d, RID, { choice: 'team_pick' })).ok).toBe(false)
    expect((await savePickCore(deps().d, 'not-a-uuid', { choice: 'team_pick' })).ok).toBe(false)
  })
  it('refuses an unknown choice', async () => {
    expect((await savePickCore(deps().d, RID, { choice: 'bogus' as never })).ok).toBe(false)
  })
})

describe('savePickCore: lock cases', () => {
  it.each(['submitted', 'in_review'])('status %s + unlocked = ok', async (status) => {
    const { d, write } = deps({ req: { status } })
    expect(await savePickCore(d, RID, { choice: 'team_pick' })).toEqual({ ok: true })
    expect(write).toHaveBeenCalledOnce()
  })
  it('locked (Lina approved / license recorded) = refused', async () => {
    const { d, write } = deps({ req: { template_locked_at: hoursAgo(1) } })
    expect(await savePickCore(d, RID, { choice: 'team_pick' })).toEqual({ ok: false, error: 'locked' })
    expect(write).not.toHaveBeenCalled()
  })
  it('closed = refused', async () => {
    const { d, write } = deps({ req: { status: 'closed' } })
    expect(await savePickCore(d, RID, { choice: 'team_pick' })).toEqual({ ok: false, error: 'locked' })
    expect(write).not.toHaveBeenCalled()
  })
  it('isPickEditable truth table', () => {
    expect(isPickEditable({ status: 'submitted', template_locked_at: null })).toBe(true)
    expect(isPickEditable({ status: 'in_review', template_locked_at: null })).toBe(true)
    expect(isPickEditable({ status: 'in_review', template_locked_at: 'x' })).toBe(false)
    expect(isPickEditable({ status: 'closed', template_locked_at: null })).toBe(false)
  })
})

describe('savePickCore: catalog picks', () => {
  it('saves a fresh, matching item with template_picked_at = now', async () => {
    const { d, write } = deps()
    expect(await savePickCore(d, RID, { choice: 'envato_catalog', envatoItemId: 101 })).toEqual({ ok: true })
    expect(write).toHaveBeenCalledWith(RID, { template_choice: 'envato_catalog', envato_item_id: 101, pasted_template_url: null, template_picked_at: NOW.toISOString() })
  })
  it('refuses the wrong business type', async () => {
    const { d, write } = deps({ item: item({ autoNiches: ['dental'] }) })
    expect(await savePickCore(d, RID, { choice: 'envato_catalog', envatoItemId: 101 })).toEqual({ ok: false, error: 'stale' })
    expect(write).not.toHaveBeenCalled()
  })
  it('refuses a stale item (> 6h) and accepts just under 6h', async () => {
    expect(await savePickCore(deps({ item: item({ lastSeenAt: hoursAgo(6.01) }) }).d, RID, { choice: 'envato_catalog', envatoItemId: 101 })).toEqual({ ok: false, error: 'stale' })
    expect(await savePickCore(deps({ item: item({ lastSeenAt: hoursAgo(6) }) }).d, RID, { choice: 'envato_catalog', envatoItemId: 101 })).toEqual({ ok: false, error: 'stale' })
    expect(await savePickCore(deps({ item: item({ lastSeenAt: hoursAgo(5.9) }) }).d, RID, { choice: 'envato_catalog', envatoItemId: 101 })).toEqual({ ok: true })
  })
  it('refuses items missing from the catalog, removed, or never seen', async () => {
    for (const it of [null, item({ status: 'removed' }), item({ lastSeenAt: null })]) {
      expect(await savePickCore(deps({ item: it }).d, RID, { choice: 'envato_catalog', envatoItemId: 101 })).toEqual({ ok: false, error: 'stale' })
    }
  })
  it('refuses a bad item id', async () => {
    for (const id of [0, -1, 1.5, NaN, null]) {
      expect((await savePickCore(deps().d, RID, { choice: 'envato_catalog', envatoItemId: id as number })).ok).toBe(false)
    }
  })
  it('widen exception: a logged widen for this type lets a non-matching item through', async () => {
    const team: WidenRow = { id: 7, niche: 'cleaning', request_id: null, actor_role: 'team' }
    const mine: WidenRow = { id: 8, niche: 'cleaning', request_id: RID, actor_role: 'client' }
    for (const w of [team, mine]) {
      const { d, write } = deps({ item: item({ autoNiches: ['dental'] }), widen: w })
      expect(await savePickCore(d, RID, { choice: 'envato_catalog', envatoItemId: 101, widenLogId: w.id })).toEqual({ ok: true })
      expect(write).toHaveBeenCalledOnce()
    }
  })
  it('widen exception does not apply for another type, another request, a missing log, or a stale item', async () => {
    const bad: Array<WidenRow | null> = [
      { id: 7, niche: 'dental', request_id: null, actor_role: 'team' },
      { id: 7, niche: 'cleaning', request_id: '00000000-0000-4000-8000-000000000999', actor_role: 'client' },
      { id: 7, niche: 'cleaning', request_id: null, actor_role: 'client' },
      null,
    ]
    for (const w of bad) {
      expect(await savePickCore(deps({ item: item({ autoNiches: ['dental'] }), widen: w }).d, RID, { choice: 'envato_catalog', envatoItemId: 101, widenLogId: 7 })).toEqual({ ok: false, error: 'stale' })
    }
    const staleWiden = deps({ item: item({ autoNiches: ['dental'], lastSeenAt: hoursAgo(7) }), widen: { id: 7, niche: 'cleaning', request_id: null, actor_role: 'team' } })
    expect(await savePickCore(staleWiden.d, RID, { choice: 'envato_catalog', envatoItemId: 101, widenLogId: 7 })).toEqual({ ok: false, error: 'stale' })
    expect(widenApplies(null, RID, 'cleaning')).toBe(false)
  })
})

describe('savePickCore: pasted links', () => {
  it('saves a valid ThemeForest item link (trimmed)', async () => {
    const { d, write } = deps()
    expect(await savePickCore(d, RID, { choice: 'client_pasted', pastedUrl: '  https://themeforest.net/item/sparkle/123  ' })).toEqual({ ok: true })
    expect(write).toHaveBeenCalledWith(RID, expect.objectContaining({ template_choice: 'client_pasted', envato_item_id: null, pasted_template_url: 'https://themeforest.net/item/sparkle/123' }))
  })
  it.each([
    'http://themeforest.net/item/a/1', 'https://themeforest.net/category/x', 'https://themeforest.net/item/', 'https://evil.com/https://themeforest.net/item/a',
    'https://themeforest.net.evil.com/item/a', 'https://user@themeforest.net/item/a/1', 'https://themeforest.net/item/a b', '', 'javascript:alert(1)',
    'https://themeforest.net/item/' + 'a'.repeat(472),
  ])('refuses %s', async (url) => {
    const { d, write } = deps()
    expect(await savePickCore(d, RID, { choice: 'client_pasted', pastedUrl: url })).toEqual({ ok: false, error: 'paste' })
    expect(write).not.toHaveBeenCalled()
  })
  it('accepts exactly 500 chars', () => {
    expect(isValidPastedUrl('https://themeforest.net/item/' + 'a'.repeat(471))).toBe(true)
  })
})

describe('savePickCore: business_type', () => {
  it('is saved with the pick when empty', async () => {
    const { d, write } = deps({ req: { business_type: null } })
    expect(await savePickCore(d, RID, { choice: 'envato_catalog', envatoItemId: 101, businessType: 'cleaning' })).toEqual({ ok: true })
    expect(write).toHaveBeenCalledWith(RID, expect.objectContaining({ business_type: 'cleaning', envato_item_id: 101 }))
  })
  it('is required when empty and never inferred from the template', async () => {
    const { d, write } = deps({ req: { business_type: null } })
    expect(await savePickCore(d, RID, { choice: 'envato_catalog', envatoItemId: 101 })).toEqual({ ok: false, error: 'save' })
    expect(await savePickCore(d, RID, { choice: 'team_pick', businessType: 'bakery' })).toEqual({ ok: false, error: 'save' })
    expect(write).not.toHaveBeenCalled()
  })
  it('is not overwritten once set (a different type is refused; same type is fine)', async () => {
    const { d, write } = deps()
    expect(await savePickCore(d, RID, { choice: 'team_pick', businessType: 'dental' })).toEqual({ ok: false, error: 'save' })
    expect(await savePickCore(d, RID, { choice: 'team_pick', businessType: 'cleaning' })).toEqual({ ok: true })
    expect(write).toHaveBeenCalledWith(RID, expect.not.objectContaining({ business_type: expect.anything() }))
  })
  it('checks the item against the type being saved', async () => {
    const { d } = deps({ req: { business_type: null }, item: item({ autoNiches: ['cleaning'] }) })
    expect(await savePickCore(d, RID, { choice: 'envato_catalog', envatoItemId: 101, businessType: 'dental' })).toEqual({ ok: false, error: 'stale' })
  })
})

describe('savePickCore: failures stay generic', () => {
  it('a lost race (conditional write matched 0 rows) is a save error', async () => {
    expect(await savePickCore(deps({ write: false }).d, RID, { choice: 'team_pick' })).toEqual({ ok: false, error: 'save' })
  })
  it('a thrown DB error is a save error with no detail', async () => {
    const { d } = deps()
    d.lookupItem = async () => { throw new Error('relation envato_items secret detail') }
    expect(await savePickCore(d, RID, { choice: 'envato_catalog', envatoItemId: 101 })).toEqual({ ok: false, error: 'save' })
  })
})

describe('isFresh', () => {
  it('needs active + seen under 6h ago, not in the future', () => {
    const n = NOW.getTime()
    expect(isFresh({ status: 'active', lastSeenAt: hoursAgo(1) }, n)).toBe(true)
    expect(isFresh({ status: 'active', lastSeenAt: hoursAgo(6) }, n)).toBe(false)
    expect(isFresh({ status: 'active', lastSeenAt: new Date(n + 3600_000).toISOString() }, n)).toBe(false)
    expect(isFresh({ status: 'active', lastSeenAt: 'garbage' }, n)).toBe(false)
  })
})
