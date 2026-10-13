import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'owner@example.com' } as { id: string; email: string } | null,
  latest: null as Record<string, unknown> | null,
  open: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  profileUpdates: [] as Record<string, unknown>[],
  insertErrors: {} as Record<string, { message: string; code?: string } | null>,
}))

function query(table: string) {
  const q: Record<string, unknown> = {}
  let mode: 'latest' | 'open' | 'update' = 'latest'
  const chain = () => q
  Object.assign(q, {
    select: chain,
    eq: chain,
    order: chain,
    limit: chain,
    in: () => {
      mode = 'open'
      return q
    },
    maybeSingle: async () => ({ data: mode === 'open' ? state.open : state.latest }),
    update: (v: Record<string, unknown>) => {
      mode = 'update'
      state.updates.push({ table, ...v })
      return q
    },
    insert: (v: Record<string, unknown>) => {
      state.inserts.push({ table, ...v })
      const err = state.insertErrors[table] ?? null
      const res = { error: err, data: err ? null : { id: table === 'change_requests' ? 'cr-1' : 'req-new' } }
      return { select: () => ({ maybeSingle: async () => res }), then: (resolve: (v: unknown) => void) => resolve(res) }
    },
    then: (resolve: (v: unknown) => void) => resolve({ error: null }),
  })
  return q
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (t: string) => query(t),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { evaluation_progress: 0 } }) }),
      }),
      update: (v: Record<string, unknown>) => {
        state.profileUpdates.push(v)
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))
vi.mock('@/lib/supabase/ensure-profile', () => ({ ensureProfile: async () => {} }))
vi.mock('@/lib/stripe/active-subscription', () => ({
  CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE: '',
  closeBlockedPlanEndingMessage: () => '',
  getActiveSubscriptionStatus: async () => ({ active: false }),
}))
const rateAllowed = vi.hoisted(() => ({ value: true, calls: [] as unknown[][] }))
vi.mock('@/lib/rate-limit', () => ({
  HELP_CHAT_LIMIT: { bucket: 'help_chat_user', limit: 10, windowSeconds: 3600 },
  rateCheck: async (...args: unknown[]) => {
    rateAllowed.calls.push(args)
    return rateAllowed.value
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => {} }))
// after(): capture the callbacks so a test decides when (if ever) the background work runs.
const afterCalls = vi.hoisted(() => ({ fns: [] as (() => Promise<void> | void)[] }))
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => afterCalls.fns.push(fn) }))
const notify = vi.hoisted(() => ({ calls: [] as unknown[], impl: async () => null as unknown }))
vi.mock('@/lib/change-requests/notify', () => ({
  notifyNewChangeRequest: async (_admin: unknown, input: unknown) => {
    notify.calls.push(input)
    return notify.impl()
  },
}))

const alerts = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/lib/change-requests/alert', () => ({
  sendRowFailedAlert: async (a: unknown) => {
    alerts.calls.push(a)
    return { success: true, id: 'mail-1' }
  },
}))

import { sendHelpChangeRequest } from './actions'

const input = { changeType: 'Photos' as const, page: 'Home', description: 'Swap the hero photo' }

describe('sendHelpChangeRequest', () => {
  beforeEach(() => {
    state.user = { id: 'user-1', email: 'owner@example.com' }
    state.latest = null
    state.open = null
    state.updates = []
    state.inserts = []
    state.profileUpdates = []
    rateAllowed.value = true
    rateAllowed.calls = []
    state.insertErrors = {}
    afterCalls.fns = []
    notify.calls = []
    notify.impl = async () => null
    alerts.calls = []
  })

  it('is rate limited per user by the shared limiter (nothing saved when over)', async () => {
    state.latest = { status: 'submitted', business_name: 'Rivera Lawn Care', notes: '' }
    rateAllowed.value = false
    const r = await sendHelpChangeRequest(input)
    expect(r).toEqual({ ok: false, error: "You've sent this form a few times already. Please try again later." })
    expect(rateAllowed.calls[0]).toEqual([{ bucket: 'help_chat_user', limit: 10, windowSeconds: 3600 }, 'user-1'])
    expect(state.updates).toEqual([])
    expect(state.inserts).toEqual([])
  })

  it('requires sign-in', async () => {
    state.user = null
    expect(await sendHelpChangeRequest(input)).toEqual({
      ok: false,
      error: 'You must be signed in.',
    })
  })

  it('rejects an unknown change type', async () => {
    const r = await sendHelpChangeRequest({ ...input, changeType: 'Pricing' as never })
    expect(r.ok).toBe(false)
  })

  it('needs an existing request to take the business details from', async () => {
    const r = await sendHelpChangeRequest(input)
    expect(r).toEqual({
      ok: false,
      error: 'Start a website request first, then you can ask for changes here.',
    })
  })

  it('appends the change to the open request notes and keeps its details', async () => {
    const row = {
      id: 'req-1',
      status: 'submitted',
      business_name: 'Gracia Lawn',
      contact_phone: '555',
      google_business_url: 'https://g.page/x',
      notes: 'Existing notes',
    }
    state.latest = row
    state.open = { id: 'req-1', status: 'submitted' }
    const r = await sendHelpChangeRequest({ ...input, photoName: 'hero.jpg' })
    expect(r).toEqual({ ok: true, email: 'owner@example.com' })
    expect(state.inserts.filter((i) => i.table === 'website_requests')).toHaveLength(0)
    expect(state.updates[0]).toMatchObject({
      table: 'website_requests',
      business_name: 'Gracia Lawn',
      contact_phone: '555',
      google_business_url: 'https://g.page/x',
      notes:
        'Existing notes\n\nChange request (Help chat):\nType: Photos\nPage: Home\nChange: Swap the hero photo\nPhoto: hero.jpg (chosen in the chat; not uploaded)',
    })
    expect(state.profileUpdates[0]).toMatchObject({ evaluation_status: 'requested' })
  })

  it('opens a new request from a closed one, without the old notes', async () => {
    state.latest = {
      status: 'closed',
      business_name: 'Gracia Lawn',
      contact_phone: null,
      google_business_url: null,
      notes: 'Old notes',
    }
    const r = await sendHelpChangeRequest(input)
    expect(r.ok).toBe(true)
    expect(state.inserts.find((i) => i.table === 'website_requests')).toMatchObject({
      business_name: 'Gracia Lawn',
      status: 'submitted',
      notes: 'Change request (Help chat):\nType: Photos\nPage: Home\nChange: Swap the hero photo',
    })
  })

  it('also inserts a change_requests row with only the customer fields (status, billing and decision come from the server)', async () => {
    state.latest = { id: 'req-1', status: 'submitted', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'submitted' }
    const r = await sendHelpChangeRequest({ ...input, photoName: 'hero.jpg' })
    expect(r).toEqual({ ok: true, email: 'owner@example.com' })
    const rows = state.inserts.filter((i) => i.table === 'change_requests')
    expect(rows).toEqual([
      { table: 'change_requests', website_request_id: 'req-1', change_type: 'Photos', page: 'Home', description: 'Swap the hero photo', photo_name: 'hero.jpg' },
    ])
  })

  it('links the row to a newly opened request (row first, linked by the server task after)', async () => {
    state.latest = { id: 'req-old', status: 'closed', business_name: 'Gracia Lawn', notes: '' }
    await sendHelpChangeRequest(input)
    expect(state.inserts.find((i) => i.table === 'change_requests')).toMatchObject({ website_request_id: null, photo_name: null })
    await afterCalls.fns[0]()
    expect(notify.calls[0]).toMatchObject({ requestId: 'cr-1', websiteRequestId: 'req-new' })
  })

  it('answers before the webhook: the work is handed to after() and has not run when the submit returns', async () => {
    state.latest = { status: 'submitted', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'submitted' }
    const r = await sendHelpChangeRequest(input)
    expect(r.ok).toBe(true)
    expect(afterCalls.fns).toHaveLength(1)
    expect(notify.calls).toEqual([])
    await afterCalls.fns[0]()
    expect(notify.calls).toEqual([{ requestId: 'cr-1', userId: 'user-1', changeType: 'Photos', websiteRequestId: 'req-1' }])
  })

  it('a failing background task never reaches the customer (error is logged, not thrown)', async () => {
    state.latest = { status: 'submitted', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'submitted' }
    notify.impl = async () => {
      throw new Error('webhook exploded')
    }
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await sendHelpChangeRequest(input)
    expect(r.ok).toBe(true)
    await expect(afterCalls.fns[0]()).resolves.toBeUndefined()
    expect(err.mock.calls.some((c) => String(c[0]).includes('[change-requests] background task failed'))).toBe(true)
    err.mockRestore()
  })

  it('ruling 7: row fails, notes work -> still OK, logged, admin alert email after the response (no webhook)', async () => {
    state.latest = { id: 'req-1', status: 'submitted', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'submitted' }
    state.insertErrors.change_requests = { message: 'relation "public.change_requests" does not exist', code: '42P01' }
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await sendHelpChangeRequest(input)
    expect(r).toEqual({ ok: true, email: 'owner@example.com' })
    expect(state.updates[0]).toMatchObject({ table: 'website_requests' })
    expect(err.mock.calls.some((c) => String(c[0]).includes('row not saved'))).toBe(true)
    expect(alerts.calls).toEqual([]) // not before the response
    expect(afterCalls.fns).toHaveLength(1)
    await afterCalls.fns[0]()
    expect(alerts.calls).toEqual([
      { userId: 'user-1', websiteRequestId: 'req-1', businessName: 'Gracia Lawn', changeType: 'Photos', page: 'Home', reason: 'relation "public.change_requests" does not exist' },
    ])
    expect(notify.calls).toEqual([])
    err.mockRestore()
  })

  it('ruling 7: row AND notes fail -> "Please try again, or email support@freeplug-in.dev and we\'ll help."', async () => {
    state.latest = { id: 'req-1', status: 'in_review', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'in_review' } // notes append refuses an in-review request
    state.insertErrors.change_requests = { message: 'boom', code: 'XX000' }
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await sendHelpChangeRequest(input)
    expect(r).toEqual({ ok: false, error: "Please try again, or email support@freeplug-in.dev and we'll help." })
    expect(afterCalls.fns).toHaveLength(0)
    err.mockRestore()
  })

  it('notes fail but the row saved -> OK (the row is in /admin/change-requests), logged', async () => {
    state.latest = { id: 'req-1', status: 'in_review', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'in_review' }
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await sendHelpChangeRequest(input)
    expect(r).toEqual({ ok: true, email: 'owner@example.com' })
    expect(state.inserts.find((i) => i.table === 'change_requests')).toMatchObject({ website_request_id: 'req-1' })
    expect(err.mock.calls.some((c) => String(c[0]).includes('notes not appended'))).toBe(true)
    err.mockRestore()
  })

  it.each([
    [{ code: 'P0001', message: 'change_requests_pending_cap' }, 'You already have 10 change requests waiting for review. Please wait until we review some, or email support@freeplug-in.dev.'],
    [{ code: 'P0001', message: 'change_requests_daily_cap' }, "You've sent 20 change requests in the last 24 hours. Please try again tomorrow, or email support@freeplug-in.dev."],
    [{ code: '23514', message: 'new row for relation "change_requests" violates check constraint "change_requests_description_check"' }, 'Please keep your request under 2,000 characters.'],
  ])('ruling 8: DB cap %j -> friendly line, nothing appended to the notes', async (dbErr, line) => {
    state.latest = { id: 'req-1', status: 'submitted', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'submitted' }
    state.insertErrors.change_requests = dbErr
    const r = await sendHelpChangeRequest(input)
    expect(r).toEqual({ ok: false, error: line })
    expect(state.updates).toEqual([])
    expect(afterCalls.fns).toHaveLength(0)
  })

  it('description length matches the form (2,000 raw characters)', async () => {
    state.latest = { id: 'req-1', status: 'submitted', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'submitted' }
    expect(await sendHelpChangeRequest({ ...input, description: 'x'.repeat(2001) })).toEqual({ ok: false, error: 'Please keep your request under 2,000 characters.' })
    expect((await sendHelpChangeRequest({ ...input, description: 'x'.repeat(2000) })).ok).toBe(true)
    expect((await sendHelpChangeRequest({ ...input, description: '   ' })).ok).toBe(false)
  })

  it("verbatim: the row stores the customer's description and page byte for byte (emails, phones, unicode, spacing)", async () => {
    state.latest = { id: 'req-1', status: 'submitted', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'submitted' }
    const description = '  Call me at (512) 555-0199 or email josé.ñandú@example.com — swap “Café” → 🌮 tacos\nLine 2\t end  '
    const page = '  Menú / Página 2 ☕ '
    const r = await sendHelpChangeRequest({ ...input, description, page })
    expect(r.ok).toBe(true)
    const row = state.inserts.find((i) => i.table === 'change_requests')!
    expect(row.description).toBe(description)
    expect(row.page).toBe(page)
    expect(Buffer.from(String(row.description), 'utf8').equals(Buffer.from(description, 'utf8'))).toBe(true)
    expect(String(row.description)).not.toContain('[removed]')
  })
})
