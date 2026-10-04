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
    expect(state.inserts[0]).toMatchObject({
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

  it('links the row to a newly opened request', async () => {
    state.latest = { status: 'closed', business_name: 'Gracia Lawn', notes: '' }
    await sendHelpChangeRequest(input)
    expect(state.inserts.find((i) => i.table === 'change_requests')).toMatchObject({ website_request_id: 'req-new', photo_name: null })
  })

  it('answers before the webhook: the work is handed to after() and has not run when the submit returns', async () => {
    state.latest = { status: 'submitted', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'submitted' }
    const r = await sendHelpChangeRequest(input)
    expect(r.ok).toBe(true)
    expect(afterCalls.fns).toHaveLength(1)
    expect(notify.calls).toEqual([])
    await afterCalls.fns[0]()
    expect(notify.calls).toEqual([{ requestId: 'cr-1', userId: 'user-1', changeType: 'Photos' }])
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

  it('still succeeds when the change_requests row cannot be saved (e.g. migration not applied): notes only, no webhook', async () => {
    state.latest = { status: 'submitted', business_name: 'Gracia Lawn', notes: '' }
    state.open = { id: 'req-1', status: 'submitted' }
    state.insertErrors.change_requests = { message: 'relation "public.change_requests" does not exist', code: '42P01' }
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await sendHelpChangeRequest(input)
    expect(r).toEqual({ ok: true, email: 'owner@example.com' })
    expect(state.updates[0]).toMatchObject({ table: 'website_requests' })
    expect(afterCalls.fns).toHaveLength(0)
    err.mockRestore()
  })
})
