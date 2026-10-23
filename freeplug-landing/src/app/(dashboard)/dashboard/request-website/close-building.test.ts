import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Aria's ruling on f36a910 (Oct 22, 8:37 PM CT): customers close their own request at submitted,
 * in_review, consultation and agreed, not at building. At building, "Request to cancel" alerts the
 * team (log-only in test mode) and leaves the status unchanged.
 */
const state = vi.hoisted(() => ({
  open: null as { id: string; business_name: string; status: string } | null,
  rpc: [] as unknown[][],
  rpcError: null as { message: string; hint?: string } | null,
  writes: [] as unknown[],
  sent: [] as unknown[],
}))

function query() {
  const filters: [string, unknown][] = []
  const q: Record<string, unknown> = {}
  Object.assign(q, {
    select: () => q,
    in: (c: string, v: unknown) => (filters.push([c, v]), q),
    eq: (c: string, v: unknown) => (filters.push([c, v]), q),
    update: (v: unknown) => (state.writes.push(v), q),
    insert: (v: unknown) => (state.writes.push(v), q),
    maybeSingle: async () => {
      const st = filters.find(([c]) => c === 'status')
      if (st && typeof st[1] === 'string' && state.open?.status !== st[1]) return { data: null, error: null }
      return { data: filters.some(([c]) => c === 'status') ? state.open : null, error: null }
    },
  })
  return q
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'c@example.com' } } }) },
    from: () => query(),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (...a: unknown[]) => (state.rpc.push(a), { error: state.rpcError }),
    from: () => query(),
  }),
}))
vi.mock('@/lib/stripe/active-subscription', () => ({
  closeBlockedPlanEndingMessage: () => '',
  getActiveSubscriptionStatus: async () => ({ active: false }),
}))
vi.mock('@/i18n/current-locale', () => ({ currentLocale: async () => 'en' }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => {} }))
vi.mock('@/lib/email/mailer', () => ({ sendMail: async (p: unknown) => (state.sent.push(p), { success: true, id: 'x' }) }))

import { cancelOwnWebsiteRequest, requestCancelDuringBuild } from './actions'
import { loggedMail, TEAM_INBOX } from '@/lib/consultation/mail'

beforeEach(() => {
  state.open = null
  state.rpc = []
  state.rpcError = null
  state.writes = []
  state.sent = []
  loggedMail.length = 0
  delete process.env.CONSULTATION_MAIL_MODE
})

describe('customer close vs building', () => {
  it.each(['submitted', 'in_review', 'consultation', 'agreed'])('%s: close runs the close RPC', async (status) => {
    state.open = { id: 'r1', business_name: 'Biz', status }
    expect(await cancelOwnWebsiteRequest()).toEqual({ ok: true })
    expect(state.rpc).toEqual([['cancel_website_request_for_user', { p_user_id: 'u1' }]])
  })

  it('building: close is refused before the RPC, nothing written', async () => {
    state.open = { id: 'r1', business_name: 'Biz', status: 'building' }
    const r = await cancelOwnWebsiteRequest()
    expect(r).toEqual({ ok: false, error: "Your website is being built, so this request can't be closed here. Use Request to cancel." })
    expect(state.rpc).toEqual([])
    expect(state.writes).toEqual([])
  })

  it('building reached between read and close: the SQL refusal (hint building) maps to the same message', async () => {
    state.open = { id: 'r1', business_name: 'Biz', status: 'agreed' }
    state.rpcError = { message: 'Your website is being built...', hint: 'building' }
    expect(await cancelOwnWebsiteRequest()).toMatchObject({ ok: false, error: expect.stringMatching(/Request to cancel/) })
  })
})

describe('Request to cancel (building)', () => {
  it('logs a team alert, sends nothing, changes no data', async () => {
    state.open = { id: 'r1', business_name: 'Biz', status: 'building' }
    expect(await requestCancelDuringBuild()).toEqual({ ok: true })
    expect(loggedMail).toEqual([
      { to: TEAM_INBOX, subject: 'Cancel requested during build: Biz', template: 'consultation-cancel-request-team' },
    ])
    expect(state.sent).toEqual([])
    expect(state.writes).toEqual([])
    expect(state.rpc).toEqual([])
  })

  it.each(['submitted', 'agreed'])('refused when the request is %s (not building)', async (status) => {
    state.open = { id: 'r1', business_name: 'Biz', status }
    expect(await requestCancelDuringBuild()).toEqual({ ok: false, error: "We couldn't send your cancel request. Please try again." })
    expect(loggedMail).toEqual([])
  })
})
