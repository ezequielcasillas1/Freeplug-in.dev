// @vitest-environment node
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePreviewToken } from './token'

/*
 * Service-role module tests against an in-memory stand-in for the Supabase admin client. The real
 * database rules (cap trigger, review-only tables, purge) are covered by the local Postgres
 * harness (supabase/…/97_verify_outreach.sql); here we check what the server code sends.
 */

type Filter = [string, string, unknown]
type Op = { table: string; action: 'select' | 'insert' | 'update' | 'delete' | 'upsert'; values?: unknown; filters: Filter[]; count?: boolean }
type Row = Record<string, unknown>

const state = {
  ops: [] as Op[],
  uploads: [] as string[],
  removed: [] as string[],
  rpcs: [] as { fn: string; args: unknown }[],
  sites: [] as Row[],
  submissions: [] as Row[],
  photos: [] as Row[],
  carried: [] as Row[],
  jar: new Map<string, string>(),
  turnstileOk: true,
  rateOk: true,
  /** Errors the next confirm_customer_details calls return first (race simulation). */
  confirmFailures: [] as { code: string; message: string }[],
  /** Simulates Next's per-render memoization of identical GET requests (Vera QA #1). */
  memo: null as Map<string, unknown> | null,
}

// Stripe stand-in for claim step 4 (plain functions that record calls, not spies).
const stripeCalls = { checkout: [] as { params: Record<string, unknown>; opts: unknown }[], other: [] as string[] }
const stripeFake = {
  checkout: {
    sessions: {
      create: async (params: Record<string, unknown>, opts: unknown) => {
        stripeCalls.checkout.push({ params, opts })
        return { id: 'cs_setup_test', url: 'https://checkout.stripe.test/c/cs_setup_test' }
      },
    },
  },
  subscriptions: {
    create: async () => (stripeCalls.other.push('subscriptions.create'), { id: 'sub_x' }),
    list: async () => ({ data: [] }),
  },
  paymentIntents: { create: async () => (stripeCalls.other.push('paymentIntents.create'), { id: 'pi_x' }) },
  invoices: {
    create: async () => (stripeCalls.other.push('invoices.create'), { id: 'in_x' }),
    pay: async () => (stripeCalls.other.push('invoices.pay'), { id: 'in_x' }),
  },
  charges: { create: async () => (stripeCalls.other.push('charges.create'), { id: 'ch_x' }) },
}

const val = (op: Op, key: string) => op.filters.find((f) => f[1] === key)?.[2]
const matches = (row: Row, op: Op) =>
  op.filters.every(([kind, k, v]) =>
    kind === 'eq'
      ? row[k] === v
      : kind === 'neq'
        ? row[k] !== v
        : kind === 'is'
          ? (row[k] ?? null) === v
          : kind === 'in'
            ? (v as unknown[]).includes(row[k])
            : true
  )

function run(op: Op): { data: unknown; error: unknown; count?: number } {
  if (state.memo && op.action === 'select') {
    const key = JSON.stringify([op.table, op.filters])
    if (!state.memo.has(key)) state.memo.set(key, structuredClone(runOnce(op)))
    return structuredClone(state.memo.get(key)) as { data: unknown; error: unknown }
  }
  return runOnce(op)
}

function runOnce(op: Op): { data: unknown; error: unknown; count?: number } {
  state.ops.push(op)
  if (op.table === 'outreach_sites' && op.action === 'select') return { data: state.sites.filter((r) => matches(r, op)), error: null }
  // Hosting ladder (Oct 3): saveChosenPlan writes plan_step.
  if (op.table === 'outreach_sites' && op.action === 'update') {
    const rows = state.sites.filter((r) => matches(r, op))
    rows.forEach((r) => Object.assign(r, op.values as Row))
    return { data: rows, error: null }
  }
  if (op.table === 'site_details_submissions') {
    if (op.action === 'insert') {
      const row = { id: randomUUID(), review_status: 'pending', submitted_by: null, ...(op.values as Row) }
      state.submissions.push(row)
      return { data: [row], error: null }
    }
    return { data: state.submissions.filter((r) => matches(r, op)), error: null }
  }
  if (op.table === 'site_photos') {
    if (op.action === 'insert') {
      const v = op.values as Row
      // Mirrors the unique index and site_photos_enforce_cap (the SQL harness tests the real ones).
      if (state.photos.some((p) => p.outreach_site_id === v.outreach_site_id && p.client_photo_id === v.client_photo_id)) {
        return { data: null, error: { code: '23505', message: 'duplicate key' } }
      }
      // Preview: lifetime per link. Claimed customer: per upload request (submission). Organic: per user.
      const used = state.photos.filter((p) =>
        v.outreach_site_id == null
          ? p.outreach_site_id == null && p.user_id === v.user_id
          : v.source === 'preview'
            ? p.outreach_site_id === v.outreach_site_id && p.source === 'preview'
            : p.submission_id === v.submission_id
      ).length
      if (used >= 50) return { data: null, error: { code: 'P0001', message: 'Photo limit reached', hint: 'photo_limit' } }
      const row = { id: randomUUID(), ...v }
      state.photos.push(row)
      return { data: [row], error: null }
    }
    const rows = state.photos.filter((r) => matches(r, op))
    if (op.action === 'update') rows.forEach((r) => Object.assign(r, op.values as Row))
    return { data: rows, error: null, count: rows.length }
  }
  if (op.table === 'site_submission_carried_photos' && op.action === 'select') {
    return { data: state.carried.filter((r) => matches(r, op)), error: null }
  }
  return { data: op.action === 'select' ? [] : null, error: null }
}

function builder(table: string) {
  const op: Op = { table, action: 'select', filters: [] }
  const settle = (mode: 'single' | 'maybe' | 'many') => {
    const r = run(op)
    if (mode === 'many') return r
    const rows = (r.data as Row[] | null) ?? []
    return { data: rows[0] ?? null, error: r.error ?? (mode === 'single' && !rows[0] ? { message: 'no rows' } : null) }
  }
  const b: Record<string, unknown> = {
    select: (_c?: string, opts?: { count?: string }) => {
      if (opts?.count) op.count = true
      return proxy
    },
    insert: (v: unknown) => ((op.action = 'insert'), (op.values = v), proxy),
    update: (v: unknown) => ((op.action = 'update'), (op.values = v), proxy),
    upsert: (v: unknown) => ((op.action = 'upsert'), (op.values = v), proxy),
    delete: () => ((op.action = 'delete'), proxy),
    maybeSingle: async () => settle('maybe'),
    single: async () => settle('single'),
    then: (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) => Promise.resolve(settle('many')).then(ok, fail),
  }
  const proxy: Record<string, unknown> = new Proxy(b, {
    get(target, prop: string) {
      if (prop in target) return target[prop]
      return (k: string, v: unknown) => {
        op.filters.push([prop, k, v])
        return proxy
      }
    },
  })
  return proxy
}

const fakeAdmin = {
  from: (t: string) => builder(t),
  rpc: async (fn: string, args: unknown) => {
    state.rpcs.push({ fn, args })
    if (fn === 'claim_outreach_site') {
      const a = args as { p_site_id: string; p_user_id: string }
      const site = state.sites.find((x) => x.id === a.p_site_id)
      if (site) Object.assign(site, { claimed_by: a.p_user_id, claimed_at: new Date().toISOString() })
      return { data: [{ site_id: a.p_site_id, website_request_id: null, already_claimed: false }], error: null }
    }
    if (fn === 'confirm_customer_details') {
      // Mirrors the SQL function (tested for real in run-sqlcheck.sh): ONE pending customer details
      // row per site, updated in place on a second confirm (round 9), the still-pending preview
      // photos carried into it, the confirmed time.
      if (state.confirmFailures.length) return { data: null, error: state.confirmFailures.shift() }
      const a = args as { p_site_id: string; p_user_id: string; p_fields: unknown; p_services: unknown }
      const site = state.sites.find((x) => x.id === a.p_site_id && x.claimed_by === a.p_user_id)
      if (!site) return { data: null, error: { message: 'not claimed', code: '42501' } }
      const pending = state.submissions.find(
        (x) => x.outreach_site_id === a.p_site_id && x.source === 'customer' && x.review_status === 'pending' && JSON.stringify(x.fields) !== '{}'
      )
      const id = pending ? (pending.id as string) : randomUUID()
      if (pending) Object.assign(pending, { fields: a.p_fields, services: a.p_services })
      else state.submissions.push({ id, outreach_site_id: a.p_site_id, source: 'customer', submitted_by: a.p_user_id, fields: a.p_fields, services: a.p_services, review_status: 'pending' })
      for (const p of state.photos) {
        if (p.outreach_site_id === a.p_site_id && p.source === 'preview' && p.review_status === 'pending' && !state.carried.some((c) => c.photo_id === p.id)) {
          state.carried.push({ submission_id: id, photo_id: p.id })
        }
      }
      return { data: id, error: null }
    }
    if (fn === 'reject_site_details_submission') {
      // Mirrors the SQL refusal for an applied row (tested for real in 97_verify_outreach.sql).
      const sub = state.submissions.find((x) => x.id === (args as { p_submission_id: string }).p_submission_id)
      if (sub?.review_status === 'applied') {
        return { data: null, error: { code: 'P0001', message: "These details were already applied, so they can't be rejected.", hint: 'already_applied' } }
      }
    }
    return { data: null, error: null }
  },
  auth: { admin: { getUserById: async (id: string) => ({ data: { user: { id, email: 'claimer@example.com' } } }) } },
  storage: {
    from: () => ({
      upload: async (path: string) => (state.uploads.push(path), { data: { path }, error: null }),
      remove: async (paths: string[]) => (state.removed.push(...paths), { data: [], error: null }),
      createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://storage.test/${path}?sig` }, error: null }),
      createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://storage.test/${path}?sig` })), error: null }),
    }),
  },
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeAdmin }))
vi.mock('@/lib/rate-limit', () => ({
  HELP_CHAT_LIMIT: { bucket: 'help_chat_user', limit: 10, windowSeconds: 3600 },
  hashRateKey: (s: string) => `h:${s}`,
  rateCheck: async () => state.rateOk,
}))
vi.mock('./turnstile', () => ({ verifyTurnstile: async () => state.turnstileOk }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name) } : undefined),
    set: (name: string, value: string) => void (value ? state.jar.set(name, value) : state.jar.delete(name)),
  }),
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}))
vi.mock('@/lib/admin/guard', () => ({ assertAdminAccess: async () => undefined }))
vi.mock('@/lib/stripe/server', () => ({ getStripe: () => stripeFake }))
vi.mock('@/lib/stripe/config', async (orig) => ({
  ...(await orig<typeof import('@/lib/stripe/config')>()),
  appBaseUrl: () => 'http://localhost:3000',
}))
vi.mock('@/lib/stripe/active-subscription', () => ({ listLiveSubscriptions: async () => [] }))
vi.mock('@/lib/stripe/checkout-customer', () => ({
  createCheckoutCustomer: async () => 'cus_test',
  findCustomersToCheck: async () => ({ customerIds: [], ownCustomerId: null }),
}))

const server = await import('./server')
const { setImageCodec } = await import('./image')
const { sharpImageCodec } = await import('../../../test/image-codec-sharp')
setImageCodec(sharpImageCodec)

let jpeg: Blob
beforeAll(async () => {
  const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 30, g: 120, b: 60 } } }).jpeg().toBuffer()
  jpeg = new Blob([new Uint8Array(buf)], { type: 'image/jpeg' })
})

const future = () => new Date(Date.now() + 10 * 86_400_000).toISOString()
function addSite(over: Row = {}) {
  const { token, tokenHash } = generatePreviewToken()
  const site = {
    id: randomUUID(),
    token_hash: tokenHash,
    business_name: "Gracia's Lawn Service",
    expires_at: future(),
    revoked_at: null,
    declined_at: null,
    claimed_by: null,
    prefill: { hours: { value: 'Sun–Sat 8:00 am – 6:00 pm', source: 'Thumbtack profile', source_url: 'https://www.thumbtack.com/x' } },
    services: ['Lawn mowing'],
    service_sources: [{ name: 'Lawn mowing', source_label: 'On your new website and your Thumbtack profile', source_url: 'https://www.thumbtack.com/x' }],
    screenshot_desktop_path: null,
    screenshot_mobile_path: null,
    ...over,
  }
  state.sites.push(site)
  return { token, site }
}

const DETAILS = {
  fields: { phone: '512-555-0100', address: '', hours: 'Sun–Sat 8:00 am – 6:00 pm', service_area: 'San Marcos, TX', quote_email: '' },
  services: [
    { name: 'Lawn mowing', keep: false },
    { name: 'Test-only added service', keep: true },
  ],
}

const PENDING_TABLES = ['site_details_submissions', 'site_photos', 'outreach_change_requests', 'outreach_site_events']

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'local-test-service-role')
  Object.assign(stripeCalls, { checkout: [], other: [] })
  Object.assign(state, { ops: [], uploads: [], removed: [], rpcs: [], sites: [], submissions: [], photos: [], carried: [], confirmFailures: [], jar: new Map(), turnstileOk: true, rateOk: true, memo: null })
})

describe('client IP (Vera QA #3)', () => {
  it('ignores a client-sent X-Forwarded-For (only a trusted CF-Connecting-IP counts)', async () => {
    expect(await server.requestIp()).toBe('unknown-ip')
  })
})

describe('token checks', () => {
  it('unknown, malformed, expired, revoked and claimed links all look the same (no cookie)', async () => {
    const { token: expired } = addSite({ expires_at: new Date(Date.now() - 1000).toISOString() })
    const { token: revoked } = addSite({ revoked_at: new Date().toISOString() })
    const { token: claimed } = addSite({ claimed_by: randomUUID() })
    const unknown = generatePreviewToken().token
    for (const t of [expired, revoked, claimed, unknown, 'short', `${unknown.slice(0, 42)}!`]) {
      expect(await server.findUsableSiteByToken(t)).toBeNull()
      expect(await server.enterPreviewWithToken(t)).toBe(false)
      expect(state.jar.size).toBe(0)
    }
    // Malformed tokens never reach the database.
    const lookups = state.ops.filter((o) => o.table === 'outreach_sites')
    expect(lookups.every((o) => typeof val(o, 'token_hash') === 'string' && (val(o, 'token_hash') as string).length === 64)).toBe(true)
    expect(lookups).toHaveLength(8)
  })

  it('a good link sets the preview cookie; changing one character does not', async () => {
    const { token } = addSite()
    const changed = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')
    expect(await server.enterPreviewWithToken(changed)).toBe(false)
    expect(await server.enterPreviewWithToken(token)).toBe(true)
    expect(state.jar.get('fp_outreach')).toBeTruthy()
  })

  it('refuses every lookup when rate limited, even for a good link', async () => {
    const { token } = addSite()
    state.rateOk = false
    expect(await server.enterPreviewWithToken(token)).toBe(false)
  })

  it('preview data never includes source_url', async () => {
    const { token } = addSite()
    await server.enterPreviewWithToken(token)
    const data = await server.getPreviewPageData()
    expect(data?.services).toEqual([{ name: 'Lawn mowing', source: 'On your new website and your Thumbtack profile' }])
    expect(JSON.stringify(data)).not.toMatch(/source_url|thumbtack\.com/)
  })
})

async function openPreview() {
  const { token, site } = addSite()
  expect(await server.enterPreviewWithToken(token)).toBe(true)
  return site
}

describe('anonymous preview writes', () => {
  it('only INSERT into the pending tables; the added service goes only into the submission', async () => {
    const site = await openPreview()
    const sent = await server.submitPreviewDetails(DETAILS, 'ts-token')
    expect(sent.ok).toBe(true)
    await server.uploadPreviewPhoto(randomUUID(), jpeg)
    await server.submitPreviewChangeRequest({ changeType: 'text', description: 'Please fix the headline' }, 'ts-token')
    await server.declinePreview()
    const writes = state.ops.filter((o) => o.action !== 'select')
    expect(writes.length).toBeGreaterThanOrEqual(3)
    for (const w of writes) {
      expect(w.action).toBe('insert')
      expect(PENDING_TABLES).toContain(w.table)
    }
    const withAdded = writes.filter((w) => JSON.stringify(w.values).includes('Test-only added service'))
    expect(withAdded.map((w) => w.table)).toEqual(['site_details_submissions'])
    expect(state.rpcs).toEqual([])
    expect(state.uploads.every((p) => p.startsWith(`outreach/${site.id}/photos/`))).toBe(true)
  })

  it('refuses without Turnstile, when rate limited, and without a preview cookie', async () => {
    await openPreview()
    state.turnstileOk = false
    expect(await server.submitPreviewDetails(DETAILS, null)).toMatchObject({ ok: false, code: 'turnstile' })
    state.turnstileOk = true
    state.rateOk = false
    expect(await server.submitPreviewDetails(DETAILS, 't')).toMatchObject({ ok: false, code: 'rate' })
    state.jar.clear()
    state.rateOk = true
    expect(await server.submitPreviewDetails(DETAILS, 't')).toMatchObject({ ok: false, code: 'expired' })
    expect(state.submissions).toHaveLength(0)
  })

  it('stores only the fields that were sent with a value, phone as 512-555-0142 (Vera r2 bug 2/3)', async () => {
    await openPreview()
    const out = await server.submitPreviewDetails({ fields: { phone: '(512) 555 0142', address: '', hours: '' }, services: [] }, 't')
    expect(out.ok).toBe(true)
    const insert = state.ops.find((o) => o.action === 'insert' && o.table === 'site_details_submissions')
    expect((insert?.values as { fields: unknown }).fields).toEqual({ phone: '512-555-0142' })
  })

  it('refuses a phone that is not 10 digits, with the exact message', async () => {
    await openPreview()
    const out = await server.submitPreviewDetails({ fields: { phone: '555-0142' }, services: [] }, 't')
    expect(out).toMatchObject({ ok: false, code: 'invalid', error: 'Please enter a 10-digit phone number, including the area code.' })
    expect(state.submissions).toHaveLength(0)
  })

  it('photos need the pass from a sent form', async () => {
    await openPreview()
    expect(await server.uploadPreviewPhoto(randomUUID(), jpeg)).toMatchObject({ ok: false, code: 'expired' })
    expect(state.uploads).toHaveLength(0)
  })
})

describe('photo limits on the server', () => {
  it('a retried photo (same client id) is stored and counted once', async () => {
    await openPreview()
    await server.submitPreviewDetails(DETAILS, 't')
    const id = randomUUID()
    const first = await server.uploadPreviewPhoto(id, jpeg)
    const again = await server.uploadPreviewPhoto(id, jpeg)
    expect(first.ok && again.ok && first.photoId === again.photoId).toBe(true)
    expect(state.uploads).toHaveLength(1)
    expect(state.photos).toHaveLength(1)
  })

  it('50 photos across two sends from the same link; the 51st is refused with photo_limit', async () => {
    const site = await openPreview()
    await server.submitPreviewDetails(DETAILS, 't')
    for (let i = 0; i < 30; i++) expect((await server.uploadPreviewPhoto(randomUUID(), jpeg)).ok).toBe(true)
    await server.submitPreviewDetails(DETAILS, 't')
    for (let i = 0; i < 20; i++) expect((await server.uploadPreviewPhoto(randomUUID(), jpeg)).ok).toBe(true)
    expect(new Set(state.photos.map((p) => p.submission_id)).size).toBe(2)
    expect((await server.getPreviewPageData())?.photosUsed).toBe(50)
    const over = await server.uploadPreviewPhoto(randomUUID(), jpeg)
    expect(over).toMatchObject({ ok: false, code: 'photo_limit' })
    expect(state.photos.filter((p) => p.outreach_site_id === site.id)).toHaveLength(50)
    // The refused file was removed from storage again.
    expect(state.removed).toHaveLength(1)
  })

  it('refuses HEIC, other non-photo bytes and files over 5 MB (backstop for the browser checks)', async () => {
    await openPreview()
    await server.submitPreviewDetails(DETAILS, 't')
    const heic = new Blob([new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0])], { type: 'image/heic' })
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' })
    expect(await server.uploadPreviewPhoto(randomUUID(), heic)).toMatchObject({ ok: false })
    expect(await server.uploadPreviewPhoto(randomUUID(), svg)).toMatchObject({ ok: false })
    expect(await server.uploadPreviewPhoto(randomUUID(), big)).toMatchObject({ ok: false, code: 'too_large' })
    expect(await server.uploadPreviewPhoto('not-a-uuid', jpeg)).toMatchObject({ ok: false, code: 'invalid' })
    expect(state.uploads).toHaveLength(0)
    expect(state.photos).toHaveLength(0)
  })
})

describe('photo caps for signed-in customers (Jace, Sep 27)', () => {
  it('a claimed customer can send more than 50 across two requests, but not 51 in one request', async () => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId })
    const first = await server.startCustomerPhotoBatch(userId, randomUUID(), jpeg)
    if (!first.ok || !first.submissionId) throw new Error('no batch')
    for (let i = 0; i < 49; i++) expect((await server.uploadCustomerPhoto(userId, first.submissionId, randomUUID(), jpeg)).ok).toBe(true)
    expect(await server.uploadCustomerPhoto(userId, first.submissionId, randomUUID(), jpeg)).toMatchObject({ ok: false, code: 'photo_limit' })
    const second = await server.startCustomerPhotoBatch(userId, randomUUID(), jpeg)
    if (!second.ok || !second.submissionId) throw new Error('no batch')
    expect(second.submissionId).not.toBe(first.submissionId)
    for (let i = 0; i < 4; i++) expect((await server.uploadCustomerPhoto(userId, second.submissionId, randomUUID(), jpeg)).ok).toBe(true)
    expect(state.photos.filter((p) => p.outreach_site_id === site.id)).toHaveLength(55)
    // Each visit to the dashboard photo page is a new request: the box starts at 0.
    expect(await server.customerPhotosUsed(userId)).toBe(0)
  })

  it('organic customers keep their lifetime count (unchanged)', async () => {
    const userId = randomUUID()
    for (let i = 0; i < 3; i++) expect((await server.uploadCustomerPhoto(userId, null, randomUUID(), jpeg)).ok).toBe(true)
    expect(await server.customerPhotosUsed(userId)).toBe(3)
  })

  it('still rate limited per account', async () => {
    const userId = randomUUID()
    addSite({ claimed_by: userId })
    const batch = await server.startCustomerPhotoBatch(userId, randomUUID(), jpeg)
    state.rateOk = false
    expect(await server.uploadCustomerPhoto(userId, batch.ok ? batch.submissionId : null, randomUUID(), jpeg)).toMatchObject({ ok: false, code: 'rate' })
    expect(await server.startCustomerPhotoBatch(userId, randomUUID(), jpeg)).toMatchObject({ ok: false, code: 'rate' })
  })
})

describe('dashboard photo batch (Vera QA #8)', () => {
  it('a refused first photo creates no pending submission and stores nothing', async () => {
    const userId = randomUUID()
    addSite({ claimed_by: userId })
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' })
    expect(await server.startCustomerPhotoBatch(userId, randomUUID(), svg)).toMatchObject({ ok: false })
    expect(await server.startCustomerPhotoBatch(userId, randomUUID(), big)).toMatchObject({ ok: false, code: 'too_large' })
    expect(await server.startCustomerPhotoBatch(userId, 'nope', jpeg)).toMatchObject({ ok: false, code: 'invalid' })
    expect(state.submissions).toHaveLength(0)
    expect(state.uploads).toHaveLength(0)
  })

  it('the first valid photo opens the batch; a retry of it reuses the same submission', async () => {
    const userId = randomUUID()
    addSite({ claimed_by: userId })
    const id = randomUUID()
    const a = await server.startCustomerPhotoBatch(userId, id, jpeg)
    const b = await server.startCustomerPhotoBatch(userId, id, jpeg)
    expect(a.ok && b.ok && a.submissionId === b.submissionId && a.photoId === b.photoId).toBe(true)
    expect(state.submissions).toHaveLength(1)
    expect(state.photos).toHaveLength(1)
  })

  it('organic customers: no submission, the photo belongs to the user', async () => {
    const userId = randomUUID()
    expect(await server.startCustomerPhotoBatch(userId, randomUUID(), jpeg)).toMatchObject({ ok: true, submissionId: null })
    expect(state.submissions).toHaveLength(0)
    expect(state.photos).toHaveLength(1)
  })
})

describe('preview photos carry over to claim step 2 (Lina, Sep 27)', () => {
  it('returns signed links for the claimed site’s preview photos, skipping rejected and deleted copies', async () => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId })
    const base = { outreach_site_id: site.id, source: 'preview', file_deleted_at: null }
    state.photos.push(
      { ...base, id: 'a', storage_path: `outreach/${site.id}/photos/a.jpg`, review_status: 'pending' },
      { ...base, id: 'b', storage_path: `outreach/${site.id}/photos/b.jpg`, review_status: 'applied' },
      { ...base, id: 'c', storage_path: `outreach/${site.id}/photos/c.jpg`, review_status: 'rejected' },
      { ...base, id: 'd', storage_path: `outreach/${site.id}/photos/d.jpg`, review_status: 'applied', file_deleted_at: '2026-09-27T06:00:00Z' },
      { ...base, id: 'e', source: 'customer', storage_path: `outreach/${site.id}/photos/e.jpg`, review_status: 'pending' }
    )
    const out = await server.customerPreviewPhotos(userId)
    expect(out.map((p) => p.id)).toEqual(['a', 'b'])
    expect(out[0].url).toContain(`outreach/${site.id}/photos/a.jpg`)
  })

  it('returns nothing for someone who has not claimed a site', async () => {
    expect(await server.customerPreviewPhotos(randomUUID())).toEqual([])
  })
})

describe('preview photos carried into the customer’s step 2 submission (round 3)', () => {
  const STEP2 = {
    fields: { phone: '512-555-0142', address: '', hours: 'Mon–Sat 8–6', service_area: 'San Marcos, TX', quote_email: 'q@gracia.example' },
    services: [{ name: 'Lawn mowing', keep: true }],
  }
  function claimedWithPreviewPhotos() {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId })
    const previewSub = { id: randomUUID(), outreach_site_id: site.id, source: 'preview', fields: { phone: '512-555-0142' }, services: [], review_status: 'pending', submitted_at: '2026-09-27T05:50:00Z' }
    state.submissions.push(previewSub)
    const base = { outreach_site_id: site.id, submission_id: previewSub.id, source: 'preview', file_deleted_at: null }
    state.photos.push(
      { ...base, id: randomUUID(), storage_path: `outreach/${site.id}/photos/p1.jpg`, review_status: 'pending', created_at: '2026-09-27T05:50:01Z' },
      { ...base, id: randomUUID(), storage_path: `outreach/${site.id}/photos/p2.jpg`, review_status: 'pending', created_at: '2026-09-27T05:50:02Z' },
      { ...base, id: randomUUID(), storage_path: `outreach/${site.id}/photos/p3.jpg`, review_status: 'rejected', created_at: '2026-09-27T05:50:03Z' }
    )
    return { userId, site, previewSub }
  }

  it('Confirm details goes through one database call bound to the verified user, which carries the photos', async () => {
    const { userId, site } = claimedWithPreviewPhotos()
    const out = await server.confirmCustomerDetails(userId, STEP2)
    expect(out.ok).toBe(true)
    const call = state.rpcs.find((r) => r.fn === 'confirm_customer_details')
    expect(call?.args).toMatchObject({ p_site_id: site.id, p_user_id: userId })
    // Empty fields are not sent (Vera r2 bug 2): the blank address is left out.
    const { address: _blank, ...sentStep2 } = STEP2.fields
    expect((call?.args as { p_fields: unknown }).p_fields).toEqual(sentStep2)
    expect(_blank).toBe('')
    // No separate writes from the app (the RPC does the submission + carry + confirmed time).
    expect(state.ops.filter((o) => o.action !== 'select')).toEqual([])
    const sid = (out as { submissionId: string }).submissionId
    expect(state.carried.filter((c) => c.submission_id === sid)).toHaveLength(2)
  })

  it('admin: the customer row counts and shows the carried photos ("View 2 photos"); preview row keeps its own', async () => {
    const { userId, site, previewSub } = claimedWithPreviewPhotos()
    const out = await server.confirmCustomerDetails(userId, STEP2)
    const sid = (out as { submissionId: string }).submissionId
    const [row] = await server.adminListOutreachSites()
    const cust = row.pendingSubmissions.find((s) => s.id === sid)
    const prev = row.pendingSubmissions.find((s) => s.id === previewSub.id)
    expect(cust?.photoCount).toBe(2)
    expect(prev?.photoCount).toBe(3)
    // Round 4: the preview row says how many of its photos moved (Sable 1:18 AM note).
    expect(prev?.photosMoved).toBe(2)
    expect(cust?.photosMoved).toBe(0)
    const urls = await server.adminSubmissionPhotoUrls(sid)
    expect(urls).toEqual([`https://storage.test/outreach/${site.id}/photos/p1.jpg?sig`, `https://storage.test/outreach/${site.id}/photos/p2.jpg?sig`])
  })

  it('admin: services are marked added only when kept and not on the site list (Vera r2 bug 8)', async () => {
    const { site } = addSite({ claimed_by: randomUUID() })
    state.submissions.push({
      id: randomUUID(),
      outreach_site_id: site.id,
      source: 'customer',
      fields: {},
      services: [
        { name: 'Lawn mowing', keep: false },
        { name: 'Gutter cleaning', keep: true },
      ],
      review_status: 'pending',
      submitted_at: '2026-09-27T06:00:00Z',
    })
    const [row] = await server.adminListOutreachSites()
    expect(row.pendingSubmissions[0].services).toEqual([
      { name: 'Lawn mowing', keep: false, added: false },
      { name: 'Gutter cleaning', keep: true, added: true },
    ])
  })

  it('admin: after "Delete photos", only photos whose file still exists are counted (Vera r3 NEW-2)', async () => {
    const { userId, previewSub } = claimedWithPreviewPhotos()
    const out = await server.confirmCustomerDetails(userId, STEP2)
    const sid = (out as { submissionId: string }).submissionId
    state.photos.filter((p) => p.submission_id === previewSub.id).slice(0, 1).forEach((p) => Object.assign(p, { file_deleted_at: '2026-09-27T06:10:00Z' }))
    const [row] = await server.adminListOutreachSites()
    expect(row.pendingSubmissions.find((s) => s.id === sid)?.photoCount).toBe(1)
    expect(row.pendingSubmissions.find((s) => s.id === previewSub.id)?.photoCount).toBe(2)
  })

  it('admin: closed old preview rows come back as one line with what happened to their photos (Sable 1:36 AM)', async () => {
    const { userId, previewSub, site } = claimedWithPreviewPhotos()
    const out = await server.confirmCustomerDetails(userId, STEP2)
    const sid = (out as { submissionId: string }).submissionId
    const empty = { id: randomUUID(), outreach_site_id: site.id, source: 'preview', fields: {}, services: [], review_status: 'superseded', submitted_at: '2026-09-27T05:40:00Z' }
    state.submissions.push(empty)
    Object.assign(previewSub, { review_status: 'superseded' })
    const cust = state.submissions.find((x) => x.id === sid)!
    Object.assign(cust, { review_status: 'applied' })
    let [row] = await server.adminListOutreachSites()
    expect(row.pendingSubmissions).toEqual([])
    expect(row.closedPreviewSubmissions).toEqual([
      { id: previewSub.id, submitted_at: previewSub.submitted_at, outcome: 'applied' },
      { id: empty.id, submitted_at: empty.submitted_at, outcome: 'no_photos' },
    ])
    Object.assign(cust, { review_status: 'rejected' })
    ;[row] = await server.adminListOutreachSites()
    expect(row.closedPreviewSubmissions[0].outcome).toBe('rejected')
  })

  it('admin: an open old row only says "approve them there" while the customer row is pending', async () => {
    const { userId, previewSub } = claimedWithPreviewPhotos()
    const out = await server.confirmCustomerDetails(userId, STEP2)
    const sid = (out as { submissionId: string }).submissionId
    let [row] = await server.adminListOutreachSites()
    expect(row.pendingSubmissions.find((s) => s.id === previewSub.id)?.photosMoved).toBe(2)
    Object.assign(state.submissions.find((x) => x.id === sid)!, { review_status: 'applied' })
    ;[row] = await server.adminListOutreachSites()
    expect(row.pendingSubmissions.find((s) => s.id === previewSub.id)?.photosMoved).toBe(0)
  })

  it('admin Reject on an applied row is refused with Sable\'s 1:34 AM line', async () => {
    const { userId } = claimedWithPreviewPhotos()
    const out = await server.confirmCustomerDetails(userId, STEP2)
    const sid = (out as { submissionId: string }).submissionId
    Object.assign(state.submissions.find((x) => x.id === sid)!, { review_status: 'applied' })
    expect(await server.adminRejectSubmission(sid)).toEqual({ ok: false, error: "These details were already applied, so they can't be rejected." })
  })

  it('admin Reject goes through the database function (which leaves carried photos on the customer row)', async () => {
    const { previewSub } = claimedWithPreviewPhotos()
    expect(await server.adminRejectSubmission(previewSub.id)).toEqual({ ok: true })
    expect(state.rpcs).toEqual([{ fn: 'reject_site_details_submission', args: { p_submission_id: previewSub.id } }])
    expect(state.ops.filter((o) => o.action === 'update')).toEqual([])
  })
})

describe('deleting stored copies of approved photos (admin)', () => {
  it('removes only approved photos’ files, marks the rows, and a second run deletes nothing', async () => {
    const { site } = addSite({ claimed_by: randomUUID() })
    const base = { outreach_site_id: site.id, source: 'preview', file_deleted_at: null }
    state.photos.push(
      { ...base, id: 'a', storage_path: 'outreach/x/photos/a.jpg', review_status: 'applied' },
      { ...base, id: 'b', storage_path: 'outreach/x/photos/b.jpg', review_status: 'pending' },
      { ...base, id: 'c', storage_path: 'outreach/x/photos/c.jpg', review_status: 'rejected' },
      { ...base, id: 'd', storage_path: 'outreach/x/photos/d.jpg', review_status: 'applied' }
    )
    expect(await server.adminDeleteAppliedPhotoFiles(site.id)).toEqual({ ok: true, deleted: 2 })
    expect(state.removed).toEqual(['outreach/x/photos/a.jpg', 'outreach/x/photos/d.jpg'])
    expect(state.photos.filter((p) => p.file_deleted_at).map((p) => p.id)).toEqual(['a', 'd'])
    // The rows stay (the link's lifetime count never goes down).
    expect(state.photos).toHaveLength(4)
    expect(await server.adminDeleteAppliedPhotoFiles(site.id)).toEqual({ ok: true, deleted: 0 })
    expect(state.removed).toHaveLength(2)
  })

  it('refuses a malformed site id without touching storage', async () => {
    expect(await server.adminDeleteAppliedPhotoFiles('nope')).toMatchObject({ ok: false })
    expect(state.removed).toEqual([])
  })
})

describe('claim step 4 "Add my card" (Jace/Lina, Sep 27)', () => {
  it('opens setup-mode Checkout only: saves the card, creates no subscription and no charge', async () => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId, plan_step: 'starter', setup_completed_at: null, stripe_customer_id: null })
    const res = await server.startSetupCheckout({ id: userId, email: 'gracia@example.com' })
    expect(res).toEqual({ ok: true, url: 'https://checkout.stripe.test/c/cs_setup_test' })
    expect(stripeCalls.checkout).toHaveLength(1)
    const { params } = stripeCalls.checkout[0]
    expect(params.mode).toBe('setup')
    expect(params).not.toHaveProperty('line_items')
    expect(params).not.toHaveProperty('subscription_data')
    expect(params).not.toHaveProperty('payment_intent_data')
    expect(params.metadata).toMatchObject({ type: 'outreach_setup', outreach_site_id: site.id, supabase_user_id: userId })
    expect(stripeCalls.other).toEqual([])
  })

  it('refuses a second setup once the card is saved (still nothing created)', async () => {
    const userId = randomUUID()
    addSite({ claimed_by: userId, plan_step: 'starter', setup_completed_at: '2026-09-27T05:00:00Z' })
    expect(await server.startSetupCheckout({ id: userId })).toMatchObject({ ok: false, code: 'already_saved' })
    expect(stripeCalls.checkout).toEqual([])
    expect(stripeCalls.other).toEqual([])
  })
})

describe('claim step 3: choose a hosting ladder step (Oct 3)', () => {
  it('saves a valid step id and nothing else', async () => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId, plan_step: null, setup_completed_at: null })
    expect(await server.saveChosenPlan(userId, { planStep: 'fast_lane' })).toEqual({ ok: true })
    expect(state.sites.find((x) => x.id === site.id)?.plan_step).toBe('fast_lane')
  })

  it.each(['leads', 'get_found', 'growth'])('sellable=false: refuses %s on the server (claim step 3), nothing saved', async (planStep) => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId, plan_step: null, setup_completed_at: null })
    expect(await server.saveChosenPlan(userId, { planStep })).toMatchObject({ ok: false, code: 'not_sellable' })
    expect(state.sites.find((x) => x.id === site.id)?.plan_step).toBeNull()
  })

  it('a card saved for a step that is no longer sold may re-pick a sellable step (publish would refuse the old one)', async () => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId, plan_step: 'leads', setup_completed_at: '2026-09-27T05:00:00Z' })
    expect(await server.saveChosenPlan(userId, { planStep: 'priority' })).toEqual({ ok: true })
    expect(state.sites.find((x) => x.id === site.id)?.plan_step).toBe('priority')
    expect(await server.saveChosenPlan(userId, { planStep: 'starter' })).toMatchObject({ ok: false, code: 'locked' })
  })

  it.each([
    [{ planStep: 'gold' }],
    [{ planStep: 'basic' }],
    [{ hostingMonthlyCents: 3500, addonTier: 'none' }],
    [{ planStep: 'starter', addonTier: 'pro' }],
  ])('refuses %j (retired slider/add-ons, unknown steps)', async (input) => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId, plan_step: null, setup_completed_at: null })
    expect(await server.saveChosenPlan(userId, input)).toMatchObject({ ok: false, code: 'invalid' })
    expect(state.sites.find((x) => x.id === site.id)?.plan_step).toBeNull()
  })

  it('is locked once a card is saved for a step, and once live', async () => {
    const a = randomUUID()
    addSite({ claimed_by: a, plan_step: 'starter', setup_completed_at: '2026-09-27T05:00:00Z' })
    expect(await server.saveChosenPlan(a, { planStep: 'growth' })).toMatchObject({ ok: false, code: 'locked' })
    const b = randomUUID()
    addSite({ claimed_by: b, plan_step: 'starter', publish_status: 'live' })
    expect(await server.saveChosenPlan(b, { planStep: 'growth' })).toMatchObject({ ok: false, code: 'locked' })
  })

  it('a card saved with a pre-ladder choice (no plan_step) may pick a step once; the old columns are untouched', async () => {
    const userId = randomUUID()
    const { site } = addSite({
      claimed_by: userId,
      plan_step: null,
      plan_hosting_cents: 4000,
      plan_addon_tier: 'pro',
      setup_completed_at: '2026-09-27T05:00:00Z',
    })
    expect(await server.saveChosenPlan(userId, { planStep: 'fast_lane' })).toEqual({ ok: true })
    const row = state.sites.find((x) => x.id === site.id)!
    expect(row.plan_step).toBe('fast_lane')
    expect(row.plan_hosting_cents).toBe(4000)
    expect(row.plan_addon_tier).toBe('pro')
    expect(await server.saveChosenPlan(userId, { planStep: 'growth' })).toMatchObject({ ok: false, code: 'locked' })
  })

  it('setup Checkout refuses a site that only has a pre-ladder choice (no_plan)', async () => {
    const userId = randomUUID()
    addSite({ claimed_by: userId, plan_step: null, plan_hosting_cents: 3500, plan_addon_tier: 'none', setup_completed_at: null })
    expect(await server.startSetupCheckout({ id: userId })).toMatchObject({ ok: false, code: 'no_plan' })
    expect(stripeCalls.checkout).toEqual([])
  })

  it('admin Publish (the server action path) refuses a step that is not sold: no subscription, nothing charged', async () => {
    const userId = randomUUID()
    const { site } = addSite({
      claimed_by: userId,
      plan_step: 'get_found',
      setup_completed_at: '2026-09-27T05:00:00Z',
      stripe_customer_id: 'cus_pub',
      stripe_payment_method_id: 'pm_pub',
      publish_status: null,
    })
    const res = await server.adminPublishSite(site.id, { claimerVerified: true })
    expect(res).toMatchObject({ ok: false, status: 'refused' })
    expect((res as { error: string }).error).toMatch(/Get found is not sold yet/)
    expect(stripeCalls.other).toEqual([])
  })

  it('setup Checkout refuses a step that is not sold (sellable=false), nothing created', async () => {
    const userId = randomUUID()
    addSite({ claimed_by: userId, plan_step: 'growth', setup_completed_at: null })
    expect(await server.startSetupCheckout({ id: userId })).toMatchObject({ ok: false, code: 'not_sellable' })
    expect(stripeCalls.checkout).toEqual([])
    expect(stripeCalls.other).toEqual([])
  })
})

describe('claim', () => {
  it('is refused without a confirmed email, and never calls the claim RPC', async () => {
    await openPreview()
    const out = await server.claimPreviewSiteForUser({ id: randomUUID(), email_confirmed_at: null })
    expect(out).toEqual({ ok: false, reason: 'email_unconfirmed' })
    expect(state.rpcs).toEqual([])
  })

  it('first load after sign-up: returns the claimed site even when earlier lookups are memoized (Vera QA #1)', async () => {
    const site = await openPreview()
    const userId = randomUUID()
    state.memo = new Map() // one render: identical GETs return the first answer
    expect(await server.getClaimedSiteForUser(userId)).toBeNull() // the page's first lookup
    const out = await server.claimPreviewSiteForUser({ id: userId, email_confirmed_at: new Date().toISOString() })
    expect(out).toMatchObject({ ok: true, site: { id: site.id, claimed_by: userId } })
  })

  it('binds to the verified user id through the RPC', async () => {
    const site = await openPreview()
    const userId = randomUUID()
    await server.claimPreviewSiteForUser({ id: userId, email_confirmed_at: new Date().toISOString() })
    expect(state.rpcs).toEqual([{ fn: 'claim_outreach_site', args: { p_site_id: site.id, p_user_id: userId } }])
  })
})

describe('90-day cleanup of unclaimed preview photos', () => {
  it('removes the files first, then purges the rows through the RPC', async () => {
    state.photos.push({ id: 'p-old', storage_path: 'outreach/s/photos/a.jpg', source: 'preview' })
    await server.cleanupUnclaimedPreviewPhotos(new Date('2026-12-31T00:00:00Z'))
    const query = state.ops.find((o) => o.table === 'site_photos')!
    expect(query.filters).toContainEqual(['lt', 'created_at', new Date(new Date('2026-12-31T00:00:00Z').getTime() - 90 * 86_400_000).toISOString()])
    expect(query.filters).toContainEqual(['is', 'outreach_sites.claimed_by', null])
    expect(state.removed).toEqual(['outreach/s/photos/a.jpg'])
    expect(state.rpcs).toEqual([{ fn: 'purge_site_photos', args: { p_photo_ids: ['p-old'], p_older_than: '90 days' } }])
  })
})

describe('one pending customer details submission per site (Jace, round 9)', () => {
  const STEP2 = {
    fields: { phone: '512-555-0142', hours: 'Mon–Sat 8–6', service_area: 'San Marcos, TX', quote_email: 'q@gracia.example' },
    services: [{ name: 'Lawn mowing', keep: true }],
  }
  const step2b = { ...STEP2, fields: { ...STEP2.fields, hours: 'Mon–Fri 7–5' } }
  const customerRows = (siteId: unknown) => state.submissions.filter((s) => s.outreach_site_id === siteId && s.source === 'customer')

  it('a second confirm updates the same pending row instead of adding one', async () => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId })
    const a = await server.confirmCustomerDetails(userId, STEP2)
    const b = await server.confirmCustomerDetails(userId, step2b)
    if (!a.ok || !b.ok) throw new Error('confirm failed')
    expect(b.submissionId).toBe(a.submissionId)
    expect(customerRows(site.id)).toHaveLength(1)
    expect((customerRows(site.id)[0].fields as Record<string, string>).hours).toBe('Mon–Fri 7–5')
  })

  it('photos attached to the pending row stay with it after the second confirm', async () => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId })
    const a = await server.confirmCustomerDetails(userId, STEP2)
    if (!a.ok) throw new Error('confirm failed')
    for (let i = 0; i < 3; i++) expect((await server.uploadCustomerPhoto(userId, a.submissionId, randomUUID(), jpeg)).ok).toBe(true)
    const b = await server.confirmCustomerDetails(userId, step2b)
    if (!b.ok) throw new Error('confirm failed')
    expect(state.photos.filter((p) => p.submission_id === a.submissionId)).toHaveLength(3)
    expect(state.photos.every((p) => p.outreach_site_id !== site.id || p.submission_id === b.submissionId)).toBe(true)
  })

  it('applied, rejected or superseded rows are never modified; the next confirm starts a new pending row', async () => {
    for (const status of ['applied', 'rejected', 'superseded']) {
      const userId = randomUUID()
      const { site } = addSite({ claimed_by: userId })
      const a = await server.confirmCustomerDetails(userId, STEP2)
      if (!a.ok) throw new Error('confirm failed')
      const reviewed = customerRows(site.id)[0]
      reviewed.review_status = status
      const before = structuredClone(reviewed)
      const b = await server.confirmCustomerDetails(userId, step2b)
      if (!b.ok) throw new Error('confirm failed')
      expect(b.submissionId, status).not.toBe(a.submissionId)
      expect(reviewed, status).toEqual(before)
      expect(customerRows(site.id).filter((s) => s.review_status === 'pending'), status).toHaveLength(1)
    }
  })

  it('race: a unique-index error (23505) is retried once and lands on the existing row', async () => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId })
    const a = await server.confirmCustomerDetails(userId, STEP2)
    if (!a.ok) throw new Error('confirm failed')
    state.confirmFailures.push({ code: '23505', message: 'duplicate key value violates unique constraint "site_details_submissions_one_pending_customer_uidx"' })
    const b = await server.confirmCustomerDetails(userId, step2b)
    expect(b).toMatchObject({ ok: true, submissionId: a.ok ? a.submissionId : '' })
    expect(state.rpcs.filter((r) => r.fn === 'confirm_customer_details')).toHaveLength(3)
    expect(customerRows(site.id)).toHaveLength(1)
  })

  it('other errors are not retried', async () => {
    const userId = randomUUID()
    addSite({ claimed_by: userId })
    state.confirmFailures.push({ code: '42501', message: 'nope' })
    expect(await server.confirmCustomerDetails(userId, STEP2)).toMatchObject({ ok: false, code: 'save' })
    expect(state.rpcs.filter((r) => r.fn === 'confirm_customer_details')).toHaveLength(1)
  })

  it('dashboard photo batches (photos-only rows) are separate upload requests and do not block a confirm', async () => {
    const userId = randomUUID()
    const { site } = addSite({ claimed_by: userId })
    const batch = await server.startCustomerPhotoBatch(userId, randomUUID(), jpeg)
    const a = await server.confirmCustomerDetails(userId, STEP2)
    if (!batch.ok || !a.ok) throw new Error('failed')
    expect(a.submissionId).not.toBe(batch.submissionId)
    expect(customerRows(site.id)).toHaveLength(2)
  })
})
