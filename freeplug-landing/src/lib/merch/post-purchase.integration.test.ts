// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MERCH_MAX_DOWNLOADS, MERCH_TOKEN_TTL_MS, deriveMerchDownloadToken } from './tokens'
import type { MerchTokenRow } from './tokens'

function createInMemoryMerchDb() {
  const bySession = new Map<string, MerchTokenRow>()
  const byHash = new Map<string, MerchTokenRow>()
  const byId = new Map<string, MerchTokenRow>()

  const adminClient = () => ({
      from(table: string) {
        if (table !== 'merch_font_bundle_tokens') throw new Error(`unexpected table ${table}`)
        return {
          insert(row: Record<string, unknown>) {
            const sessionId = row.stripe_checkout_session_id as string
            if (bySession.has(sessionId)) {
              return Promise.resolve({ error: { code: '23505', message: 'unique_session' } })
            }
            const tokenHash = row.token_hash as string
            const full: MerchTokenRow = {
              id: randomUUID(),
              token_hash: tokenHash,
              stripe_checkout_session_id: sessionId,
              stripe_payment_intent_id: (row.stripe_payment_intent_id as string | null) ?? null,
              buyer_email: (row.buyer_email as string | null) ?? null,
              expires_at: row.expires_at as string,
              revoked_at: null,
              max_downloads: (row.max_downloads as number) ?? MERCH_MAX_DOWNLOADS,
              download_count: 0,
              created_at: new Date().toISOString(),
              last_download_at: null,
              emailed_at: null,
            }
            bySession.set(sessionId, full)
            byHash.set(tokenHash, full)
            byId.set(full.id, full)
            return Promise.resolve({ error: null })
          },
          select(cols: string) {
            return {
              eq(col: string, val: string) {
                return {
                  maybeSingle: async () => {
                    let row: MerchTokenRow | undefined
                    if (col === 'stripe_checkout_session_id') row = bySession.get(val)
                    else if (col === 'token_hash') row = byHash.get(val)
                    else if (col === 'id') row = byId.get(val)
                    if (!row) return { data: null, error: null }
                    if (cols === '*') return { data: { ...row }, error: null }
                    const picked: Record<string, unknown> = {}
                    for (const part of cols.split(',').map((s) => s.trim())) {
                      if (part in row) picked[part] = (row as Record<string, unknown>)[part]
                    }
                    return { data: picked, error: null }
                  },
                  is: (col: string, v: null) => ({
                    select: () => ({
                      maybeSingle: async () => {
                        const row = bySession.get(val)
                        if (!row || col !== 'emailed_at' || v !== null) return { data: null, error: null }
                        if (row.emailed_at !== null) return { data: null, error: null }
                        return { data: { id: row.id }, error: null }
                      },
                    }),
                  }),
                }
              },
            }
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col1: string, idOrSession: string) {
                const second = {
                  eq(col2: string, expectedCount: number) {
                    return {
                      select: () => ({
                        maybeSingle: async () => {
                          const row = col1 === 'id' ? byId.get(idOrSession) : undefined
                          if (!row || col2 !== 'download_count' || row.download_count !== expectedCount) {
                            return { data: null, error: { message: 'conflict' } }
                          }
                          row.download_count = patch.download_count as number
                          row.last_download_at = (patch.last_download_at as string) ?? null
                          return { data: { download_count: row.download_count }, error: null }
                        },
                      }),
                    }
                  },
                  is: (col: string, v: null) => ({
                    select: () => ({
                      maybeSingle: async () => {
                        const row =
                          col1 === 'stripe_checkout_session_id'
                            ? bySession.get(idOrSession)
                            : col1 === 'id'
                              ? byId.get(idOrSession)
                              : undefined
                        if (!row || col !== 'emailed_at' || v !== null || row.emailed_at !== null) {
                          return { data: null, error: null }
                        }
                        row.emailed_at = (patch.emailed_at as string) ?? new Date().toISOString()
                        return { data: { id: row.id }, error: null }
                      },
                    }),
                  }),
                }
                if (col1 === 'stripe_checkout_session_id' && patch.emailed_at === null) {
                  const row = bySession.get(idOrSession)
                  if (row) row.emailed_at = null
                }
                if (col1 === 'id' && patch.emailed_at === null) {
                  const row = byId.get(idOrSession)
                  if (row) row.emailed_at = null
                }
                return second
              },
            }
          },
        }
      },
  })

  return {
    adminClient,
    getRow: (sessionId: string) => bySession.get(sessionId),
    setExpiresAt: (sessionId: string, iso: string) => {
      const row = bySession.get(sessionId)
      if (row) row.expires_at = iso
    },
    setDownloadCount: (sessionId: string, n: number) => {
      const row = bySession.get(sessionId)
      if (row) row.download_count = n
    },
  }
}

type InMemoryMerchDb = ReturnType<typeof createInMemoryMerchDb>

const BUYER = 'buyer-font-bundle@test.local'
const capturedMail: Array<{ to: string; subject: string }> = []
let mailShouldFail = false
let stripeSessions: Record<string, object> = {}
let db: InMemoryMerchDb

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => db.adminClient(),
}))

vi.mock('@/lib/stripe/server', () => ({
  getStripeFetch: () => ({
    checkout: {
      sessions: {
        retrieve: async (id: string) => {
          const s = stripeSessions[id]
          if (!s) throw new Error(`no session ${id}`)
          return s
        },
      },
    },
  }),
}))

vi.mock('@/lib/email/mailer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/mailer')>()
  return {
    ...actual,
    sendMail: vi.fn(async (opts: { to: string; subject: string; react: unknown }) => {
      if (mailShouldFail) throw new Error('simulated resend failure')
      capturedMail.push({ to: opts.to, subject: opts.subject })
      return { success: true }
    }),
  }
})

vi.mock('@/lib/merch/storage', () => ({
  readMerchBundleBytes: async () => Buffer.from('mock-zip-bytes'),
  isMerchMockBundle: () => true,
  merchDownloadFilename: () => 'freeplug-font-bundle-v1.zip',
}))

function paidMerchSession(id: string) {
  return {
    id,
    metadata: { checkout_type: 'merch_font_bundle', product_slug: 'freeplug-font-bundle' },
    payment_status: 'paid',
    payment_intent: `pi_${createHash('sha256').update(id).digest('hex').slice(0, 16)}`,
    customer_details: { email: BUYER },
  }
}

async function parseJson(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

describe('Font bundle post-purchase integration', () => {
  beforeEach(() => {
    db = createInMemoryMerchDb()
    capturedMail.length = 0
    mailShouldFail = false
    stripeSessions = {}
    process.env.MERCH_TOKEN_SECRET = 'test-merch-signing-secret'
    process.env.STRIPE_SECRET_KEY = 'sk_test_local_stub'
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.freeplug-in.dev'
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deterministic token matches session id', () => {
    const a = deriveMerchDownloadToken('cs_same', process.env)
    const b = deriveMerchDownloadToken('cs_same', process.env)
    expect(a).toBe(b)
    expect(a).not.toBe(deriveMerchDownloadToken('cs_other', process.env))
  })

  it('Order A: success first, refresh still shows link; webhook sends email once', async () => {
    const sid = 'cs_order_a'
    stripeSessions[sid] = paidMerchSession(sid)
    const { GET: sessionToken } = await import('@/app/api/merch/session-token/route')
    const { handleMerchCheckoutSessionCompleted } = await import('@/lib/merch/webhook')

    const first = await parseJson(await sessionToken(new Request(`http://localhost/api/merch/session-token?session_id=${sid}`)))
    expect(first.downloadUrl).toBeTruthy()
    expect(first.token).toBe(deriveMerchDownloadToken(sid))

    const refresh = await parseJson(await sessionToken(new Request(`http://localhost/api/merch/session-token?session_id=${sid}`)))
    expect(refresh.downloadUrl).toBe(first.downloadUrl)
    expect(refresh.token).toBe(first.token)

    await handleMerchCheckoutSessionCompleted(db.adminClient() as never, paidMerchSession(sid) as never)
    expect(capturedMail).toHaveLength(1)

    await handleMerchCheckoutSessionCompleted(db.adminClient() as never, paidMerchSession(sid) as never)
    expect(capturedMail).toHaveLength(1)
    expect(db.getRow(sid)?.emailed_at).toBeTruthy()
  })

  it('Order B: webhook first then success — same link on page', async () => {
    const sid = 'cs_order_b'
    stripeSessions[sid] = paidMerchSession(sid)
    const { handleMerchCheckoutSessionCompleted } = await import('@/lib/merch/webhook')
    const { GET: sessionToken } = await import('@/app/api/merch/session-token/route')

    await handleMerchCheckoutSessionCompleted(db.adminClient() as never, paidMerchSession(sid) as never)
    expect(capturedMail).toHaveLength(1)

    const page = await parseJson(await sessionToken(new Request(`http://localhost/api/merch/session-token?session_id=${sid}`)))
    expect(page.downloadUrl).toMatch(/\/api\/merch\/download\?token=/)
    expect(page.token).toBe(deriveMerchDownloadToken(sid))
    expect(capturedMail).toHaveLength(1)
  })

  it('email failure then webhook retry sends once', async () => {
    mailShouldFail = true
    const sid = 'cs_email_retry'
    stripeSessions[sid] = paidMerchSession(sid)
    const { handleMerchCheckoutSessionCompleted } = await import('@/lib/merch/webhook')

    await handleMerchCheckoutSessionCompleted(db.adminClient() as never, paidMerchSession(sid) as never)
    expect(capturedMail).toHaveLength(0)
    expect(db.getRow(sid)?.emailed_at).toBeNull()

    mailShouldFail = false
    await handleMerchCheckoutSessionCompleted(db.adminClient() as never, paidMerchSession(sid) as never)
    expect(capturedMail).toHaveLength(1)
  })

  it('5 downloads succeed; 6th refused', async () => {
    const sid = 'cs_download_limit'
    stripeSessions[sid] = paidMerchSession(sid)
    const { GET: sessionToken } = await import('@/app/api/merch/session-token/route')
    const issued = await parseJson(await sessionToken(new Request(`http://localhost/api/merch/session-token?session_id=${sid}`)))
    const token = String(issued.token)
    const { GET: download } = await import('@/app/api/merch/download/route')

    for (let i = 1; i <= MERCH_MAX_DOWNLOADS; i++) {
      const res = await download(new Request(`http://localhost/api/merch/download?token=${encodeURIComponent(token)}`))
      expect(res.status).toBe(200)
    }
    const sixth = await download(new Request(`http://localhost/api/merch/download?token=${encodeURIComponent(token)}`))
    expect(sixth.status).toBe(403)
    expect((await parseJson(sixth)).error).toBe('Download limit reached for this link.')

    const afterLimit = await parseJson(await sessionToken(new Request(`http://localhost/api/merch/session-token?session_id=${sid}`)))
    expect(afterLimit.unavailable).toBe('limit')
    expect(afterLimit.downloadUrl).toBeUndefined()
  })

  it('expired session-token shows limit state without download link', async () => {
    const sid = 'cs_expired'
    stripeSessions[sid] = paidMerchSession(sid)
    const { GET: sessionToken } = await import('@/app/api/merch/session-token/route')
    await sessionToken(new Request(`http://localhost/api/merch/session-token?session_id=${sid}`))
    db.setExpiresAt(sid, new Date(Date.now() - 60_000).toISOString())

    const expired = await parseJson(await sessionToken(new Request(`http://localhost/api/merch/session-token?session_id=${sid}`)))
    expect(expired.unavailable).toBe('expired')
    expect(expired.supportEmail).toBe('support@freeplug-in.dev')
    expect(expired.downloadUrl).toBeUndefined()
  })

  it('TTL constant remains 24h', () => {
    expect(MERCH_TOKEN_TTL_MS).toBe(86_400_000)
  })
})
