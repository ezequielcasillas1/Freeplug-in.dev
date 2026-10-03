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
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'freeplug.example' }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {}, delete: () => {} }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/admin/guard', () => ({ assertAdminAccess: async () => {}, isAdminAccessAllowed: async () => true }))

// Supabase (admin generateLink for the reset; server client for the Supabase-mailer fallback).
const sb = vi.hoisted(() => ({ generateLink: vi.fn(), resetPasswordForEmail: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ auth: { admin: { generateLink: sb.generateLink } }, from: vi.fn() }),
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
import { SUBSCRIPTION_CANCELLED_SUBJECT } from './templates/subscription-cancelled'
import { requestPasswordReset } from '@/app/(auth)/actions'
import { adminSendCustomerEmail } from '@/app/admin/actions'
import { GET as testEmailGET } from '@/app/api/test-email/route'
import { POST as stripeWebhookPOST } from '@/app/api/webhooks/stripe/route'

const FAKE_KEY = 're_test_fake_vitest_only'
const FROM = '"Freeplug" <support@freeplug-in.dev>'
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
    expect(msg.from).toMatch(/<[^@<>]+@freeplug-in\.dev>$/)
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
    expect(sent()[0]).toMatchObject({ from: '"Freeplug Team" <hello@freeplug-in.dev>', replyTo: 'help@freeplug-in.dev' })
  })

  it('defaults: From on the main domain @freeplug-in.dev (never the send. return-path subdomain), Reply-To support@', async () => {
    expect(getEmailFrom()).toBe(FROM)
    await sendWelcomeEmail('a@example.com')
    const { from, replyTo } = sent()[0] as { from: string; replyTo: string }
    expect(from).toMatch(/<[^@<>]+@freeplug-in\.dev>$/)
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
    expect(await sendWelcomeEmail('d@example.com')).toEqual({ success: false, error: MAIL_NOT_CONFIGURED })
    expect(rs.send).not.toHaveBeenCalled()
    expect(rs.keys).toEqual([])
    expect(log.mock.calls.flat().join(' ')).toContain('RESEND_API_KEY is not set')
    expect(log.mock.calls.flat().join(' ')).not.toContain('d@example.com')
  })

  it('a Resend API error or a thrown SDK error is a failure, never an exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    rs.send.mockResolvedValueOnce({ data: null, error: { message: 'API key is invalid', name: 'validation_error' } })
    expect(await sendWelcomeEmail('e@example.com')).toEqual({ success: false, error: 'API key is invalid' })
    rs.send.mockRejectedValueOnce(new Error('network down'))
    expect(await sendWelcomeEmail('e@example.com')).toEqual({ success: false, error: 'network down' })
  })

  it('users see a generic message in production; the detail stays in the log', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(publicMailError(MAIL_NOT_CONFIGURED)).toBe(MAIL_GENERIC_ERROR)
    vi.stubEnv('NODE_ENV', 'test')
    expect(publicMailError(MAIL_NOT_CONFIGURED)).toBe(MAIL_NOT_CONFIGURED)
  })
})

describe('password reset (requestPasswordReset)', () => {
  const recovery = (email: string, identities: { provider: string }[]) => ({
    data: { properties: { hashed_token: 'hashed_tok_1' }, user: { id: 'u1', email, identities } },
    error: null,
  })

  it('email account: the reset email via Resend, neutral page', async () => {
    const email = uniqueEmail('reset')
    sb.generateLink.mockResolvedValue(recovery(email, [{ provider: 'email' }]))
    const fd = new FormData()
    fd.set('email', email)
    expect(await expectRedirect(requestPasswordReset(fd))).toBe('/forgot-password?sent=1')
    expect(sb.generateLink).toHaveBeenCalledWith({ type: 'recovery', email })
    expect(sent()).toHaveLength(1)
    expect(sent()[0]).toMatchObject({ to: email, from: FROM, subject: 'Reset your Freeplug password', replyTo: REPLY_TO })
    expect(String(sent()[0].html)).toContain('hashed_tok_1')
    expect(sb.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('Google-only account: the "How to sign in" notice via Resend', async () => {
    const email = uniqueEmail('google')
    sb.generateLink.mockResolvedValue(recovery(email, [{ provider: 'google' }]))
    const fd = new FormData()
    fd.set('email', email)
    expect(await expectRedirect(requestPasswordReset(fd))).toBe('/forgot-password?sent=1')
    expect(sent()).toHaveLength(1)
    expect(sent()[0]).toMatchObject({ to: email, from: FROM, subject: 'How to sign in to Freeplug' })
  })

  it('no RESEND_API_KEY: nothing goes to Resend; Supabase Auth sends it (its own mailer); same neutral page', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const email = uniqueEmail('nokey')
    const fd = new FormData()
    fd.set('email', email)
    expect(await expectRedirect(requestPasswordReset(fd))).toBe('/forgot-password?sent=1')
    expect(rs.send).not.toHaveBeenCalled()
    expect(rs.keys).toEqual([])
    expect(sb.generateLink).not.toHaveBeenCalled()
    expect(sb.resetPasswordForEmail).toHaveBeenCalledWith(email, expect.objectContaining({ redirectTo: expect.any(String) }))
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
