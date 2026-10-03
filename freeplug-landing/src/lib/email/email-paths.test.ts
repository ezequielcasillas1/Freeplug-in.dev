// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Resend primary (Oct 3): every email the app sends goes through the Resend client with the right
 * to / from / subject. The `resend` SDK is replaced by a fake class: nothing here can reach
 * api.resend.com (vitest.setup.ts also makes any fetch to it throw).
 */
const rs = vi.hoisted(() => ({ send: vi.fn(), keys: [] as string[] }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: rs.send }
    constructor(key: string) {
      rs.keys.push(key)
    }
  },
}))

// Next.js request APIs.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url })
  },
}))
const hdr = vi.hoisted(() => ({ extra: {} as Record<string, string> }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'freeplug.example', ...hdr.extra }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {}, delete: () => {} }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/admin/guard', () => ({ assertAdminAccess: async () => {}, isAdminAccessAllowed: async () => true }))

// Supabase (admin generateLink for the reset; server client for the Supabase-mailer fallback).
// rate_limit_hits stand-in (the reset-fallback counter): insert + select().eq().gte().order().limit().
const sb = vi.hoisted(() => ({
  generateLink: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  hits: [] as { bucket: string; key_hash: string; hit_at: string }[],
  dbDown: false,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { generateLink: sb.generateLink } },
    from: (table: string) => {
      if (table !== 'rate_limit_hits') throw new Error(`unexpected table ${table}`)
      return {
        insert: async (row: { bucket: string; key_hash: string }) => {
          if (sb.dbDown) return { error: { message: 'db down' } }
          sb.hits.push({ ...row, hit_at: new Date().toISOString() })
          return { error: null }
        },
        select: () => {
          const f: { eq?: [string, string]; gte?: [string, string] } = {}
          const q = {
            eq: (k: string, v: string) => ((f.eq = [k, v]), q),
            gte: (k: string, v: string) => ((f.gte = [k, v]), q),
            order: () => q,
            limit: async () => {
              if (sb.dbDown) return { data: null, error: { message: 'db down' } }
              const rows = sb.hits
                .filter((h) => (!f.eq || h.bucket === f.eq[1]) && (!f.gte || h.hit_at >= f.gte[1]))
                .sort((a, b) => (a.hit_at < b.hit_at ? 1 : -1))
              return { data: rows, error: null }
            },
          }
          return q
        },
      }
    },
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { resetPasswordForEmail: sb.resetPasswordForEmail } }),
}))

// Stripe (webhook + cancel notice), in memory.
const st = vi.hoisted(() => ({
  constructEventAsync: vi.fn(),
  sub: {} as Record<string, unknown>,
  update: vi.fn(),
}))
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: st.constructEventAsync },
    subscriptions: {
      list: async () => ({ data: [] }),
      retrieve: async () => ({ ...st.sub, metadata: { ...(st.sub.metadata as object) } }),
      update: async (id: string, p: { metadata?: Record<string, string> }) => {
        st.update(id, p)
        st.sub = { ...st.sub, metadata: { ...(st.sub.metadata as object), ...p.metadata } }
        return st.sub
      },
    },
    customers: { retrieve: async () => ({ id: 'cus_1', email: 'owner@example.com' }) },
  }),
}))

import {
  sendBillingReminderEmail,
  sendPasswordResetEmail,
  sendPaymentReceivedEmail,
  sendRequestStatusUpdateEmail,
  sendSubscriptionCancelledEmail,
  sendWelcomeEmail,
} from './send'
import { MAIL_GENERIC_ERROR, MAIL_NOT_CONFIGURED, getEmailFrom, publicMailError, sendMail } from './mailer'
import {
  RESET_FALLBACK_BUCKET,
  RESET_SEND_TIMEOUT_MS,
  __resetFallbackMemoryForTests,
  getResetFallbackStatus,
  resetFallbackReason,
} from './reset-fallback'
import { RESET_NEUTRAL_MESSAGE } from '@/lib/auth/password-reset'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdminMailBanner } from '@/app/admin/AdminMailBanner'
import { SUBSCRIPTION_CANCELLED_SUBJECT } from './templates/subscription-cancelled'
import { requestPasswordReset } from '@/app/(auth)/actions'
import { adminSendCustomerEmail } from '@/app/admin/actions'
import { GET as testEmailGET } from '@/app/api/test-email/route'
import { POST as stripeWebhookPOST } from '@/app/api/webhooks/stripe/route'

const FAKE_KEY = 're_test_fake_vitest_only'
const FROM = 'Freeplug <no-reply@freeplug-in.dev>'
const REPLY_TO = 'support@freeplug-in.dev'

let n = 0
const uniqueEmail = (tag: string) => `${tag}-${++n}-${Date.now()}@example.com`
const sent = () => rs.send.mock.calls.map((c) => c[0] as Record<string, unknown>)

async function expectRedirect(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    const url = (e as { url?: string }).url
    if (url) return url
    throw e
  }
  throw new Error('expected a redirect')
}

beforeEach(() => {
  rs.send.mockReset()
  rs.send.mockResolvedValue({ data: { id: 'email_fake_1' }, error: null })
  rs.keys.length = 0
  sb.generateLink.mockReset()
  sb.resetPasswordForEmail.mockReset()
  sb.resetPasswordForEmail.mockResolvedValue({ error: null })
  sb.hits.length = 0
  sb.dbDown = false
  hdr.extra = {}
  __resetFallbackMemoryForTests()
  vi.stubEnv('RESEND_API_KEY', FAKE_KEY)
  vi.stubEnv('EMAIL_FROM', '')
  vi.stubEnv('EMAIL_FROM_NAME', '')
  vi.stubEnv('EMAIL_REPLY_TO', '')
  vi.stubEnv('RESEND_FROM_EMAIL', '')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'dummy-service-role-for-tests')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('send.ts helpers: one Resend call each, with to / from / subject / reply-to', () => {
  const cases: [string, () => Promise<unknown>, string][] = [
    ['welcome', () => sendWelcomeEmail('a@example.com', 'Ana'), 'Welcome to Freeplug!'],
    [
      'payment received',
      () => sendPaymentReceivedEmail('a@example.com', { amount: '$49.00', planName: 'Hosting', paymentDate: 'Oct 3, 2026' }),
      'Payment received - $49.00',
    ],
    [
      'request status',
      () => sendRequestStatusUpdateEmail('a@example.com', { businessName: 'Rio Tacos', newStatus: 'in_review' }),
      'Request Update: Rio Tacos',
    ],
    [
      'subscription cancelled',
      () => sendSubscriptionCancelledEmail('a@example.com', { endDate: 'Oct 25, 2026' }),
      SUBSCRIPTION_CANCELLED_SUBJECT,
    ],
    [
      'billing reminder',
      () =>
        sendBillingReminderEmail('a@example.com', {
          planName: 'Hosting',
          amount: '$49.00',
          billingDate: 'Nov 1, 2026',
          daysUntilBilling: 3,
        }),
      'Upcoming billing reminder - $49.00 on Nov 1, 2026',
    ],
    [
      'password reset',
      () => sendPasswordResetEmail('a@example.com', { resetLink: 'https://freeplug.example/auth/confirm?x=1' }),
      'Reset your Freeplug password',
    ],
  ]
  it.each(cases)('%s', async (_name, run, subject) => {
    expect(await run()).toEqual({ success: true, id: 'email_fake_1' })
    expect(rs.send).toHaveBeenCalledTimes(1)
    const [msg, opts] = rs.send.mock.calls[0]
    expect(msg).toMatchObject({ to: 'a@example.com', from: FROM, subject, replyTo: REPLY_TO })
    expect(msg.from).toBe('Freeplug <no-reply@freeplug-in.dev>')
    expect(msg.from).not.toMatch(/@send\./)
    expect(typeof msg.html).toBe('string')
    expect(msg.text).toEqual(expect.any(String)) // plain-text part
    expect(opts).toBeUndefined() // no idempotency key unless asked
    expect(rs.keys.every((k) => k === FAKE_KEY)).toBe(true)
  })

  it('the client is built with RESEND_API_KEY (rebuilt when the key changes)', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_other_fake_key')
    await sendWelcomeEmail('a@example.com')
    expect(rs.keys).toEqual(['re_test_other_fake_key'])
  })
})

describe('sender configuration', () => {
  it('EMAIL_FROM / EMAIL_FROM_NAME / EMAIL_REPLY_TO override the defaults', async () => {
    vi.stubEnv('EMAIL_FROM', 'hello@freeplug-in.dev')
    vi.stubEnv('EMAIL_FROM_NAME', 'Freeplug Team')
    vi.stubEnv('EMAIL_REPLY_TO', 'help@freeplug-in.dev')
    await sendWelcomeEmail('b@example.com')
    expect(sent()[0]).toMatchObject({ from: 'Freeplug Team <hello@freeplug-in.dev>', replyTo: 'help@freeplug-in.dev' })
  })

  it('a display name with special characters is quoted', () => {
    vi.stubEnv('EMAIL_FROM_NAME', 'Freeplug, Inc.')
    expect(getEmailFrom()).toBe('"Freeplug, Inc." <no-reply@freeplug-in.dev>')
  })

  it('defaults: From Freeplug <no-reply@freeplug-in.dev> (never the send. subdomain), Reply-To support@', async () => {
    expect(getEmailFrom()).toBe('Freeplug <no-reply@freeplug-in.dev>')
    await sendWelcomeEmail('a@example.com')
    const { from, replyTo } = sent()[0] as { from: string; replyTo: string }
    expect(from).toBe('Freeplug <no-reply@freeplug-in.dev>')
    expect(from).not.toMatch(/@send\./)
    expect(replyTo).toBe('support@freeplug-in.dev')
  })

  it('per-message replyTo wins; null omits it; the idempotency key is passed as the request option', async () => {
    await sendMail({ to: 'c@example.com', subject: 's', text: 't', replyTo: 'cust@example.com', idempotencyKey: 'evt_9:x' })
    await sendMail({ to: 'c@example.com', subject: 's', text: 't', replyTo: null })
    expect(rs.send.mock.calls[0][0]).toMatchObject({ replyTo: 'cust@example.com', text: 't' })
    expect(rs.send.mock.calls[0][1]).toEqual({ idempotencyKey: 'evt_9:x' })
    expect(rs.send.mock.calls[1][0]).not.toHaveProperty('replyTo')
  })
})

describe('missing or failing Resend: fails closed, nothing sent, no other transport', () => {
  it('no RESEND_API_KEY: { success: false }, a clear log line, the Resend client is never built', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await sendWelcomeEmail('d@example.com')).toEqual({ success: false, reason: 'not_configured', error: MAIL_NOT_CONFIGURED })
    expect(rs.send).not.toHaveBeenCalled()
    expect(rs.keys).toEqual([])
    expect(log.mock.calls.flat().join(' ')).toContain('RESEND_API_KEY is not set')
    expect(log.mock.calls.flat().join(' ')).not.toContain('d@example.com')
  })

  it('classifies failures: 4xx/5xx = http with status, statusCode null or a throw = network, no answer = timeout', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    rs.send.mockResolvedValueOnce({ data: null, error: { message: 'API key is invalid', name: 'validation_error', statusCode: 403 } })
    expect(await sendWelcomeEmail('e@example.com')).toEqual({ success: false, reason: 'http', status: 403, error: 'API key is invalid' })
    rs.send.mockResolvedValueOnce({ data: null, error: { message: 'Internal server error', name: 'application_error', statusCode: 503 } })
    expect(await sendWelcomeEmail('e@example.com')).toMatchObject({ success: false, reason: 'http', status: 503 })
    rs.send.mockResolvedValueOnce({
      data: null,
      error: { message: 'Unable to fetch data. The request could not be resolved.', name: 'application_error', statusCode: null },
    })
    expect(await sendWelcomeEmail('e@example.com')).toMatchObject({ success: false, reason: 'network', status: null })
    rs.send.mockRejectedValueOnce(new Error('network down'))
    expect(await sendWelcomeEmail('e@example.com')).toMatchObject({ success: false, reason: 'network', error: 'network down' })
    rs.send.mockReturnValueOnce(new Promise(() => {}))
    expect(await sendMail({ to: 'e@example.com', subject: 's', text: 't', timeoutMs: 20 })).toMatchObject({ success: false, reason: 'timeout' })
    // Logs carry status/name only, never the Resend message (it can echo the address) or the recipient.
    const logged = log.mock.calls.flat().join(' ')
    expect(logged).toContain('503')
    expect(logged).not.toContain('e@example.com')
    expect(logged).not.toContain('API key is invalid')
  })

  it('users see a generic message in production; the detail stays in the log', () => {
    expect(MAIL_GENERIC_ERROR).toBe(
      "We couldn't send that email right now. Please try again in a few minutes. If it still doesn't work, email support@freeplug-in.dev."
    )
    vi.stubEnv('NODE_ENV', 'production')
    expect(publicMailError(MAIL_NOT_CONFIGURED)).toBe(MAIL_GENERIC_ERROR)
    vi.stubEnv('NODE_ENV', 'test')
    expect(publicMailError(MAIL_NOT_CONFIGURED)).toBe(MAIL_NOT_CONFIGURED)
  })
})

describe('password reset (requestPasswordReset): Resend first, loud Supabase fallback, rate limit first', () => {
  const NEUTRAL = '/forgot-password?sent=1'
  const recovery = (email: string, identities: { provider: string }[] = [{ provider: 'email' }]) => ({
    data: { properties: { hashed_token: 'hashed_tok_1' }, user: { id: 'u1', email, identities } },
    error: null,
  })
  function logs() {
    return {
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    }
  }
  const allLogged = (l: ReturnType<typeof logs>) =>
    [l.warn, l.error, l.info, l.log].flatMap((s) => s.mock.calls.flat().map(String)).join('\n')
  const fallbackWarnings = (l: ReturnType<typeof logs>) =>
    l.warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('FALLBACK to Supabase'))
  async function submit(email: string): Promise<string> {
    const fd = new FormData()
    fd.set('email', email)
    return expectRedirect(requestPasswordReset(fd))
  }

  type Case = {
    name: string
    arrange: () => void
    resendCalls: number
    fallback: string | null // expected reason in the warning, or null = no fallback
  }
  const cases: Case[] = [
    { name: 'Resend accepts (id returned): no fallback', arrange: () => {}, resendCalls: 1, fallback: null },
    { name: 'no RESEND_API_KEY', arrange: () => vi.stubEnv('RESEND_API_KEY', ''), resendCalls: 0, fallback: 'reason=missing_key' },
    {
      name: 'no service role key',
      arrange: () => vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', ''),
      resendCalls: 0,
      fallback: 'reason=missing_service_role',
    },
    {
      name: 'Resend 5xx',
      arrange: () => rs.send.mockResolvedValue({ data: null, error: { message: 'Internal', name: 'application_error', statusCode: 503 } }),
      resendCalls: 1,
      fallback: 'reason=resend_http status=503',
    },
    {
      name: 'Resend 4xx',
      arrange: () => rs.send.mockResolvedValue({ data: null, error: { message: 'Invalid from', name: 'validation_error', statusCode: 422 } }),
      resendCalls: 1,
      fallback: 'reason=resend_http status=422',
    },
    {
      name: 'network error, no response (SDK statusCode null)',
      arrange: () =>
        rs.send.mockResolvedValue({ data: null, error: { message: 'Unable to fetch data.', name: 'application_error', statusCode: null } }),
      resendCalls: 1,
      fallback: 'reason=resend_network',
    },
    {
      name: 'network error thrown by the SDK',
      arrange: () => rs.send.mockRejectedValue(new TypeError('fetch failed')),
      resendCalls: 1,
      fallback: 'reason=resend_network',
    },
  ]

  it.each(cases)('$name', async ({ arrange, resendCalls, fallback }) => {
    arrange()
    const l = logs()
    const email = uniqueEmail('reset')
    sb.generateLink.mockResolvedValue(recovery(email))
    expect(await submit(email)).toBe(NEUTRAL)
    expect(rs.send).toHaveBeenCalledTimes(resendCalls)
    if (resendCalls) {
      expect(sent()[0]).toMatchObject({ to: email, from: FROM, subject: 'Reset your Freeplug password', replyTo: REPLY_TO })
      expect(String(sent()[0].html)).toContain('hashed_tok_1')
    }
    if (fallback) {
      expect(sb.resetPasswordForEmail).toHaveBeenCalledTimes(1)
      expect(sb.resetPasswordForEmail).toHaveBeenCalledWith(email, expect.objectContaining({ redirectTo: expect.any(String) }))
      expect(fallbackWarnings(l)).toHaveLength(1)
      expect(fallbackWarnings(l)[0]).toContain(fallback)
    } else {
      expect(sb.resetPasswordForEmail).not.toHaveBeenCalled()
      expect(fallbackWarnings(l)).toEqual([])
    }
    // Never the recipient in any log line.
    expect(allLogged(l)).not.toContain(email)
  })

  it('fallback decision: only when Resend clearly did not accept (an id never falls back)', () => {
    expect(resetFallbackReason({ success: true, id: 'email_1' })).toBeNull()
    expect(resetFallbackReason({ success: true, id: '' })).toBeNull() // 2xx without an id: accepted, no duplicate
    expect(resetFallbackReason({ success: false, reason: 'not_configured', error: 'x' })).toEqual({ reason: 'missing_key', status: null })
    expect(resetFallbackReason({ success: false, reason: 'http', status: 500, error: 'x' })).toEqual({ reason: 'resend_http', status: 500 })
    expect(resetFallbackReason({ success: false, reason: 'http', status: 429, error: 'x' })).toEqual({ reason: 'resend_http', status: 429 })
    expect(resetFallbackReason({ success: false, reason: 'network', status: null, error: 'x' })).toEqual({ reason: 'resend_network', status: null })
    expect(resetFallbackReason({ success: false, reason: 'timeout', error: 'x' })).toEqual({ reason: 'resend_timeout', status: null })
    expect(resetFallbackReason({ success: false, reason: 'local_error', error: 'x' })).toEqual({ reason: 'resend_local_error', status: null })
    expect(RESET_SEND_TIMEOUT_MS).toBe(8000)
  })

  it('fallbacks are counted for the admin banner (database = all isolates)', async () => {
    logs()
    vi.stubEnv('RESEND_API_KEY', '')
    await submit(uniqueEmail('count'))
    await submit(uniqueEmail('count'))
    expect(sb.hits.map((h) => [h.bucket, h.key_hash])).toEqual([
      [RESET_FALLBACK_BUCKET, 'missing_key'],
      [RESET_FALLBACK_BUCKET, 'missing_key'],
    ])
    expect(await getResetFallbackStatus()).toMatchObject({ count: 2, lastReason: 'missing_key', source: 'database' })
    const html = renderToStaticMarkup(await AdminMailBanner())
    expect(html).toContain('Email not configured')
    expect(html).toContain('Email degraded: 2 password resets fell back to the Supabase mailer in the last 24 h')
    expect(html).toContain('missing_key')
  })

  it('without the service role (or with the DB down) the banner still counts this instance', async () => {
    logs()
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await submit(uniqueEmail('inst'))
    expect(sb.hits).toEqual([])
    expect(await getResetFallbackStatus()).toMatchObject({ count: 1, lastReason: 'missing_service_role', source: 'instance' })
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'dummy-service-role-for-tests')
    sb.dbDown = true
    expect(renderToStaticMarkup(await AdminMailBanner())).toContain('counted on this server instance only')
  })

  it('no banner warning when Resend accepted every reset', async () => {
    logs()
    const email = uniqueEmail('ok')
    sb.generateLink.mockResolvedValue(recovery(email))
    await submit(email)
    expect(await getResetFallbackStatus()).toMatchObject({ count: 0 })
    const html = renderToStaticMarkup(await AdminMailBanner())
    expect(html).toContain('Email (Resend) is configured.')
    expect(html).not.toContain('Email degraded')
  })

  it('Google-only account: the "How to sign in" notice via Resend, no Supabase reset even if it fails', async () => {
    logs()
    const email = uniqueEmail('google')
    sb.generateLink.mockResolvedValue(recovery(email, [{ provider: 'google' }]))
    expect(await submit(email)).toBe(NEUTRAL)
    expect(sent()[0]).toMatchObject({ to: email, from: FROM, subject: 'How to sign in to Freeplug' })
    const email2 = uniqueEmail('google')
    sb.generateLink.mockResolvedValue(recovery(email2, [{ provider: 'google' }]))
    rs.send.mockResolvedValue({ data: null, error: { message: 'x', name: 'application_error', statusCode: 500 } })
    expect(await submit(email2)).toBe(NEUTRAL)
    expect(sb.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('unknown email: nothing sent anywhere, same response', async () => {
    logs()
    sb.generateLink.mockResolvedValue({ data: null, error: { message: 'User not found' } })
    expect(await submit(uniqueEmail('nobody'))).toBe(NEUTRAL)
    expect(rs.send).not.toHaveBeenCalled()
    expect(sb.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('rate-limited (same email within a minute): neither Resend nor Supabase is called, same response', async () => {
    logs()
    const email = uniqueEmail('limit')
    sb.generateLink.mockResolvedValue(recovery(email))
    expect(await submit(email)).toBe(NEUTRAL)
    expect(rs.send).toHaveBeenCalledTimes(1)
    rs.send.mockClear()
    sb.generateLink.mockClear()
    // Even in the fallback configuration, a limited request reaches neither path.
    vi.stubEnv('RESEND_API_KEY', '')
    expect(await submit(email)).toBe(NEUTRAL)
    expect(rs.send).not.toHaveBeenCalled()
    expect(sb.generateLink).not.toHaveBeenCalled()
    expect(sb.resetPasswordForEmail).not.toHaveBeenCalled()
    expect(sb.hits).toEqual([])
  })

  it('rate-limited by IP (trusted CF-Connecting-IP, 6th request in 10 min): neither path, same response', async () => {
    logs()
    vi.stubEnv('TRUST_CF_CONNECTING_IP', 'true')
    vi.stubEnv('RESEND_API_KEY', '')
    hdr.extra = { 'cf-connecting-ip': `203.0.113.${(Date.now() % 200) + 1}` }
    for (let i = 0; i < 5; i++) expect(await submit(uniqueEmail('ip'))).toBe(NEUTRAL)
    expect(sb.resetPasswordForEmail).toHaveBeenCalledTimes(5)
    sb.resetPasswordForEmail.mockClear()
    expect(await submit(uniqueEmail('ip'))).toBe(NEUTRAL)
    expect(sb.resetPasswordForEmail).not.toHaveBeenCalled()
    expect(rs.send).not.toHaveBeenCalled()
  })

  it('the response is identical in every case (no account enumeration)', async () => {
    logs()
    const outcomes: string[] = []
    const run = async (arrange: () => void, linkFor?: (e: string) => unknown) => {
      vi.stubEnv('RESEND_API_KEY', FAKE_KEY)
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'dummy-service-role-for-tests')
      rs.send.mockReset()
      rs.send.mockResolvedValue({ data: { id: 'email_fake_1' }, error: null })
      arrange()
      const email = uniqueEmail('same')
      sb.generateLink.mockResolvedValue(linkFor ? linkFor(email) : recovery(email))
      outcomes.push(await submit(email))
      return email
    }
    await run(() => {}) // accepted
    for (const c of cases) await run(c.arrange) // every fallback case
    await run(() => {}, () => ({ data: null, error: { message: 'User not found' } })) // unknown account
    await run(() => {}, (e) => recovery(e, [{ provider: 'google' }])) // Google-only
    const limited = await run(() => {})
    const fd = new FormData()
    fd.set('email', limited)
    outcomes.push(await expectRedirect(requestPasswordReset(fd))) // throttled
    sb.resetPasswordForEmail.mockRejectedValueOnce(new Error('supabase down'))
    await run(() => vi.stubEnv('RESEND_API_KEY', '')) // fallback itself throws
    expect(new Set(outcomes)).toEqual(new Set([NEUTRAL]))
    expect(outcomes).toHaveLength(cases.length + 6)
    expect(RESET_NEUTRAL_MESSAGE).toBe('If an account exists for that email, we sent a reset link.')
  })
})

describe('admin "Send email" (adminSendCustomerEmail)', () => {
  it('sends the admin text via Resend', async () => {
    expect(await adminSendCustomerEmail('cust@example.com', 'Your site', 'Hello there')).toEqual({ ok: true })
    expect(sent()[0]).toMatchObject({ to: 'cust@example.com', from: FROM, subject: 'Your site', text: 'Hello there', replyTo: REPLY_TO })
  })

  it('missing key in production: a generic error for the admin, nothing sent', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await adminSendCustomerEmail('cust@example.com', 'Your site', 'Hello')).toEqual({ ok: false, error: MAIL_GENERIC_ERROR })
    expect(rs.send).not.toHaveBeenCalled()
  })
})

describe('/api/test-email (admin-only)', () => {
  it('sends the test email via Resend', async () => {
    const res = await testEmailGET(new Request('http://localhost/api/test-email?to=qa@example.com'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, emailId: 'email_fake_1' })
    expect(sent()[0]).toMatchObject({ to: 'qa@example.com', from: FROM, subject: 'Test Email from Freeplug' })
  })

  it('no RESEND_API_KEY: 500 with a clear message, nothing sent', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await testEmailGET(new Request('http://localhost/api/test-email?to=qa@example.com'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe(MAIL_NOT_CONFIGURED)
    expect(rs.send).not.toHaveBeenCalled()
  })
})

describe('Stripe webhook cancellation notice (real cancel-notice + send, fake Resend)', () => {
  const PERIOD_END = 1792886400
  function setToCancel() {
    st.update.mockReset()
    st.sub = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      cancel_at_period_end: true,
      cancel_at: null,
      canceled_at: 1790000000,
      metadata: {},
      items: { data: [{ current_period_end: PERIOD_END }] },
    }
  }
  async function deliver(eventId: string) {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_dummy')
    st.constructEventAsync.mockResolvedValue({ id: eventId, type: 'customer.subscription.updated', data: { object: { ...st.sub } } })
    const res = await stripeWebhookPOST(
      new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' })
    )
    return res.status
  }

  it('sends to the customer with the idempotency key `<event.id>:subscription-cancelled`, after the claim write', async () => {
    setToCancel()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    expect(await deliver('evt_cancel_1')).toBe(200)
    expect(rs.send).toHaveBeenCalledTimes(1)
    const [msg, opts] = rs.send.mock.calls[0]
    expect(msg).toMatchObject({ to: 'owner@example.com', from: FROM, subject: SUBSCRIPTION_CANCELLED_SUBJECT })
    expect(opts).toEqual({ idempotencyKey: 'evt_cancel_1:subscription-cancelled' })
    expect(st.update).toHaveBeenCalledTimes(1)
    expect(st.update.mock.invocationCallOrder[0]).toBeLessThan(rs.send.mock.invocationCallOrder[0])
  })

  it.each([
    ['Resend returns an error', () => rs.send.mockResolvedValue({ data: null, error: { message: 'boom', name: 'application_error' } })],
    ['the Resend SDK throws', () => rs.send.mockRejectedValue(new Error('socket hang up'))],
    ['RESEND_API_KEY is missing', () => vi.stubEnv('RESEND_API_KEY', '')],
  ])('%s: the webhook still answers 2xx (the claim write stays committed)', async (_name, arrange) => {
    setToCancel()
    arrange()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const status = await deliver('evt_cancel_fail')
    expect(status).toBeGreaterThanOrEqual(200)
    expect(status).toBeLessThan(300)
    expect(st.update).toHaveBeenCalledTimes(1)
  })
})
