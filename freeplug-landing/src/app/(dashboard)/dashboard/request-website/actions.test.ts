import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'owner@example.com' } as { id: string; email: string } | null,
  latest: null as Record<string, unknown> | null,
  open: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  profileUpdates: [] as Record<string, unknown>[],
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
    insert: async (v: Record<string, unknown>) => {
      state.inserts.push({ table, ...v })
      return { error: null }
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
    expect(state.inserts).toHaveLength(0)
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
})
