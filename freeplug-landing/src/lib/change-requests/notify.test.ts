// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const ent = vi.hoisted(() => ({
  value: { step: { id: 'starter' }, legacy: false, includedEditsPerMonth: 1, bigChangesPerMonth: 0, addons: [] } as Record<string, unknown>,
  fail: false,
}))
vi.mock('@/lib/plans/user-entitlements', () => ({
  getUserEntitlements: async () => {
    if (ent.fail) throw new Error('snapshot read failed')
    return { entitlements: ent.value, source: 'snapshot' }
  },
}))
const stripe = vi.hoisted(() => ({ periodStart: 1759550400 as number | null, calls: 0 }))
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    subscriptions: {
      list: async () => {
        stripe.calls++
        return { data: stripe.periodStart ? [{ items: { data: [{ current_period_start: stripe.periodStart }] }, current_period_start: stripe.periodStart }] : [] }
      },
    },
  }),
}))

import { classifyChangeRequest, deliverChangeRequest, notifyNewChangeRequest } from './notify'
import { CHANGE_WEBHOOK_NOT_CONFIGURED } from './webhook'

const ID = '6f1c2a9e-3b7d-4e8a-9c41-2d5f8a7b0c13'

/** In-memory stand-in for the service-role client (only the calls notify.ts makes). */
function fakeAdmin(opts: { smallUsed?: number; bigUsed?: number; customer?: string | null } = {}) {
  const row: Record<string, unknown> = {
    id: ID,
    user_id: 'user-1',
    change_type: 'Photos',
    page: 'Home',
    description: 'Swap the hero photo; call me at 512-555-0199',
    photo_name: 'hero.jpg',
    plan_step: null,
    billing: 'unknown',
    created_at: '2026-10-04T20:05:00.000Z',
    website_requests: { business_name: 'Rivera Plumbing' },
    notified_at: null,
    notify_error: null,
  }
  const tables: string[] = []
  const admin = {
    row,
    tables,
    from(table: string) {
      tables.push(table)
      const filters: Record<string, unknown> = {}
      let patch: Record<string, unknown> | null = null
      let head = false
      const q: Record<string, unknown> = {
        select: (_cols: string, o?: { head?: boolean }) => {
          head = Boolean(o?.head)
          return q
        },
        update: (p: Record<string, unknown>) => {
          patch = p
          return q
        },
        eq: (k: string, v: unknown) => {
          filters[k] = v
          return q
        },
        maybeSingle: async () => {
          if (table === 'profiles') return { data: { stripe_customer_id: opts.customer === undefined ? 'cus_local' : opts.customer }, error: null }
          if (table === 'change_requests') return { data: filters.id === ID ? { ...row } : null, error: null }
          return { data: null, error: null }
        },
        then: (resolve: (v: unknown) => void) => {
          if (patch && table === 'change_requests') {
            Object.assign(row, patch)
            return resolve({ error: null })
          }
          if (head && table === 'included_edit_uses') return resolve({ count: opts.smallUsed ?? 0, error: null })
          if (head && table === 'big_change_uses') return resolve({ count: opts.bigUsed ?? 0, error: null })
          return resolve({ error: null })
        },
      }
      return q
    },
  }
  return admin
}

describe('classifyChangeRequest (server side, service role)', () => {
  beforeEach(() => {
    ent.fail = false
    ent.value = { step: { id: 'starter' }, legacy: false, includedEditsPerMonth: 1, bigChangesPerMonth: 0, addons: [] }
    stripe.periodStart = 1759550400
  })
  it('included with a use left; paid_addon when used', async () => {
    expect(await classifyChangeRequest(fakeAdmin({ smallUsed: 0 }) as never, 'user-1', 'Photos')).toEqual({ billing: 'included', planStep: 'starter' })
    expect(await classifyChangeRequest(fakeAdmin({ smallUsed: 1 }) as never, 'user-1', 'Photos')).toEqual({ billing: 'paid_addon', planStep: 'starter' })
  })
  it('unknown for "Something else", no customer, no active period, or a failed lookup', async () => {
    expect((await classifyChangeRequest(fakeAdmin() as never, 'user-1', 'Something else')).billing).toBe('unknown')
    expect(await classifyChangeRequest(fakeAdmin({ customer: null }) as never, 'user-1', 'Photos')).toEqual({ billing: 'unknown', planStep: null })
    stripe.periodStart = null
    expect((await classifyChangeRequest(fakeAdmin() as never, 'user-1', 'Photos')).billing).toBe('unknown')
    ent.fail = true
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await classifyChangeRequest(fakeAdmin() as never, 'user-1', 'Photos')).billing).toBe('unknown')
    err.mockRestore()
  })
})

describe('deliverChangeRequest / notifyNewChangeRequest (local fake receiver)', () => {
  const hits: { auth?: string; body: string }[] = []
  let mode: 'ok' | '500' | 'slow' = 'ok'
  let server: http.Server
  let base = ''
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        hits.push({ auth: req.headers.authorization, body: Buffer.concat(chunks).toString() })
        if (mode === 'ok') res.writeHead(200).end()
        else if (mode === '500') res.writeHead(500).end()
        else setTimeout(() => res.writeHead(200).end(), 1500)
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(async () => {
    server.closeAllConnections()
    await new Promise((r) => server.close(r))
  })
  beforeEach(() => {
    hits.length = 0
    mode = 'ok'
    ent.fail = false
    stripe.periodStart = 1759550400
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3381')
    vi.stubEnv('CHANGE_APPROVAL_WEBHOOK_URL', `${base}/hook`)
    vi.stubEnv('CHANGE_APPROVAL_WEBHOOK_KEY', 'Bearer fake-local-key')
  })

  it('success: billing saved, one POST with a scrubbed v1 payload, notified_at set', async () => {
    const admin = fakeAdmin({ smallUsed: 0 })
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const res = await notifyNewChangeRequest(admin as never, { requestId: ID, userId: 'user-1', changeType: 'Photos' })
    info.mockRestore()
    expect(res).toEqual({ ok: true, status: 200 })
    expect(hits).toHaveLength(1)
    expect(hits[0].auth).toBe('Bearer fake-local-key')
    const body = JSON.parse(hits[0].body)
    expect(body).toMatchObject({ v: 1, request_id: ID, business_name: 'Rivera Plumbing', billing: 'included', plan_step: 'starter', has_photo: true })
    expect(body.description).toBe('Swap the hero photo; call me at [removed]')
    expect(body.admin_url).toBe(`http://localhost:3381/admin/change-requests/${ID}`)
    expect(admin.row).toMatchObject({ billing: 'included', plan_step: 'starter', notify_error: null })
    expect(typeof admin.row.notified_at).toBe('string')
    // The stored description keeps the original.
    expect(admin.row.description).toContain('512-555-0199')
  })

  it.each([
    ['500', 'HTTP 500'],
    ['slow', 'Timed out after 0.3s'],
  ] as const)('webhook %s: one try, notify_error recorded, never throws', async (m, error) => {
    mode = m
    const admin = fakeAdmin()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await notifyNewChangeRequest(admin as never, { requestId: ID, userId: 'user-1', changeType: 'Photos' }, { timeoutMs: 300 })
    warn.mockRestore()
    expect(res).toEqual({ ok: false, error })
    expect(hits).toHaveLength(1)
    expect(admin.row).toMatchObject({ notified_at: null, notify_error: error })
  })

  it('webhook down: notify_error recorded', async () => {
    vi.stubEnv('CHANGE_APPROVAL_WEBHOOK_URL', 'http://127.0.0.1:9/hook')
    const admin = fakeAdmin()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await notifyNewChangeRequest(admin as never, { requestId: ID, userId: 'user-1', changeType: 'Photos' })
    warn.mockRestore()
    expect(res.ok).toBe(false)
    expect(String(admin.row.notify_error)).toMatch(/^Network error/)
    expect(String(admin.row.notify_error)).not.toContain('127.0.0.1')
  })

  it('env unset: skips quietly, logs it, sends nothing, notes it on the row', async () => {
    vi.stubEnv('CHANGE_APPROVAL_WEBHOOK_URL', '')
    vi.stubEnv('CHANGE_APPROVAL_WEBHOOK_KEY', '')
    const admin = fakeAdmin()
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const res = await deliverChangeRequest(admin as never, ID)
    expect(res).toEqual({ ok: false, skipped: true, error: CHANGE_WEBHOOK_NOT_CONFIGURED })
    expect(info.mock.calls.some((c) => String(c[0]).includes('webhook not configured'))).toBe(true)
    info.mockRestore()
    expect(hits).toHaveLength(0)
    expect(admin.row.notify_error).toBe(CHANGE_WEBHOOK_NOT_CONFIGURED)
  })

  it('never logs the URL or the key', async () => {
    mode = '500'
    const logs: string[] = []
    const spies = (['log', 'info', 'warn', 'error'] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')))
    )
    await notifyNewChangeRequest(fakeAdmin() as never, { requestId: ID, userId: 'user-1', changeType: 'Photos' }, { timeoutMs: 300 })
    spies.forEach((s) => s.mockRestore())
    expect(logs.join('\n')).not.toContain('fake-local-key')
    expect(logs.join('\n')).not.toContain(base)
  })

})
