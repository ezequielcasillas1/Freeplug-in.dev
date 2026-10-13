// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Hosting ladder (Oct 3): the plan-step sync is unit-tested in plan-step-sync.test.ts.
const planStepSync = vi.hoisted(() => vi.fn(async () => ({ outcome: 'updated', stepId: 'starter' })))
vi.mock('@/lib/plans/plan-step-sync', () => ({
  syncPlanStepForCustomer: planStepSync,
  supabasePlanStepStore: () => ({}),
}))

/**
 * Round 6 (Aria): the email_sends ledger, end to end through the real webhook route, the real
 * cancel-notice and the real ledger module. Stripe, the sender and the database are fakes (the
 * database fake follows the SQL, which was checked on a real Postgres 17). Nothing is sent.
 */
const h = vi.hoisted(() => ({
  ledger: null as null | ReturnType<typeof import('../../../../../test/fake-email-sends').createFakeEmailSends>,
  constructEventAsync: null as null | ((...a: unknown[]) => unknown),
}))
const sendCancelled = vi.fn()
const subMetadata: Record<string, string> = {}
const stripeCalls = { update: 0 }

vi.mock('@/lib/email/send', () => ({
  sendSubscriptionCancelledEmail: (...args: unknown[]) => sendCancelled(...args),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: (fn: string, a: Record<string, unknown>) => h.ledger!.rpc(fn, a), from: vi.fn() }),
}))
const PERIOD_END = Math.floor(Date.now() / 1000) + 20 * 86400
const liveSub = () => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: true,
  cancel_at: null,
  canceled_at: 1790000000,
  metadata: { ...subMetadata },
  items: { data: [{ current_period_end: PERIOD_END }] },
})
vi.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: (...a: unknown[]) => h.constructEventAsync!(...a) },
    subscriptions: {
      list: async () => ({ data: [] }),
      retrieve: async () => liveSub(),
      update: async (_id: string, p: { metadata: Record<string, string> }) => {
        stripeCalls.update++
        Object.assign(subMetadata, p.metadata)
        return liveSub()
      },
    },
    customers: { retrieve: async () => ({ id: 'cus_1', email: 'owner@example.com' }) },
  }),
}))

import { createFakeEmailSends } from '../../../../../test/fake-email-sends'
import { POST } from './route'

const HOUR = 3600_000
const MIN = 60_000

async function deliver(eventId: string) {
  h.constructEventAsync = async () => ({ id: eventId, type: 'customer.subscription.updated', data: { object: liveSub() } })
  const res = await POST(
    new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' })
  )
  return res.status
}

let logs: { error: ReturnType<typeof vi.spyOn>; info: ReturnType<typeof vi.spyOn> }

describe('Stripe webhook × email_sends ledger (round 6)', () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    h.ledger = createFakeEmailSends()
    for (const k of Object.keys(subMetadata)) delete subMetadata[k]
    stripeCalls.update = 0
    sendCancelled.mockReset()
    sendCancelled.mockResolvedValue({ success: true, id: 're_ok_1' })
    logs = { error: vi.spyOn(console, 'error').mockImplementation(() => {}), info: vi.spyOn(console, 'info').mockImplementation(() => {}) }
  })
  afterEach(() => {
    // No recipient address in any log line, whatever happened.
    expect(JSON.stringify([logs.error.mock.calls, logs.info.mock.calls])).not.toContain('owner@example.com')
    vi.restoreAllMocks()
  })

  it('a replay after the Resend key window: the sent row means no second send', async () => {
    expect(await deliver('evt_A')).toBe(200)
    h.ledger!.advance(25 * HOUR) // past Resend's 24 h idempotency window
    expect(await deliver('evt_A')).toBe(200)
    expect(await deliver('evt_A')).toBe(200)
    expect(sendCancelled).toHaveBeenCalledTimes(1)
    expect(sendCancelled.mock.calls[0][2]).toEqual({ idempotencyKey: 'evt_A:subscription-cancelled' })
    expect(h.ledger!.byEvent('evt_A')).toMatchObject({ status: 'sent', resend_id: 're_ok_1', attempts: 1 })
  })

  it('two concurrent deliveries: exactly one send', async () => {
    let release!: () => void
    sendCancelled.mockImplementation(() => new Promise((r) => (release = () => r({ success: true, id: 're_ok_2' }))))
    const a = deliver('evt_B')
    const b = deliver('evt_B')
    await vi.waitFor(() => expect(sendCancelled).toHaveBeenCalledTimes(1))
    release()
    expect(await Promise.all([a, b])).toEqual([200, 200])
    expect(sendCancelled).toHaveBeenCalledTimes(1)
    expect(h.ledger!.byEvent('evt_B')).toMatchObject({ status: 'sent', attempts: 1 })
    expect(h.ledger!.rows.size).toBe(1)
  })

  it('a crash after the claim: pending under 15 min skips, over 15 min re-claims and sends once', async () => {
    // The first delivery claimed (and marked the subscription), then the isolate died before sending.
    await h.ledger!.rpc('email_send_claim', { p_stripe_event_id: 'evt_C', p_template: 'subscription-cancelled' })
    Object.assign(subMetadata, { freeplug_cancel_email_sent_for: '1790000000', freeplug_cancel_email_event: 'evt_C' })
    h.ledger!.advance(5 * MIN)
    expect(await deliver('evt_C')).toBe(200)
    expect(sendCancelled).not.toHaveBeenCalled()
    h.ledger!.advance(9 * MIN) // 14 min
    expect(await deliver('evt_C')).toBe(200)
    expect(sendCancelled).not.toHaveBeenCalled()
    h.ledger!.advance(2 * MIN) // 16 min
    expect(await deliver('evt_C')).toBe(200)
    expect(sendCancelled).toHaveBeenCalledTimes(1)
    expect(h.ledger!.byEvent('evt_C')).toMatchObject({ status: 'sent', attempts: 2 })
    expect(await deliver('evt_C')).toBe(200)
    expect(sendCancelled).toHaveBeenCalledTimes(1)
    expect(stripeCalls.update).toBe(0) // the marker was already this event's
  })

  it('a Resend 5xx, then the Stripe retry: the failed row is re-claimed and sent once', async () => {
    sendCancelled.mockResolvedValueOnce({ success: false, reason: 'http', status: 503, error: 'Service unavailable' })
    expect(await deliver('evt_D')).toBe(200)
    expect(h.ledger!.byEvent('evt_D')).toMatchObject({ status: 'failed', last_error: 'http 503', attempts: 1 })
    // The "updated" event our metadata write caused never sends (another event owns this cancellation).
    expect(await deliver('evt_D2_metadata_update')).toBe(200)
    h.ledger!.advance(HOUR) // Stripe's retry
    expect(await deliver('evt_D')).toBe(200)
    expect(await deliver('evt_D')).toBe(200)
    expect(sendCancelled).toHaveBeenCalledTimes(2) // one failure + one success
    expect(sendCancelled.mock.calls.map((c) => c[2])).toEqual([
      { idempotencyKey: 'evt_D:subscription-cancelled' },
      { idempotencyKey: 'evt_D:subscription-cancelled' },
    ])
    expect(h.ledger!.byEvent('evt_D')).toMatchObject({ status: 'sent', resend_id: 're_ok_1', attempts: 2, last_error: null })
    expect(h.ledger!.byEvent('evt_D2_metadata_update')).toBeUndefined()
    expect(String(logs.error.mock.calls.flat().join(' '))).toContain('[email-ledger] send failed: event=evt_D template=subscription-cancelled sub_1 attempt=1 (http 503)')
  })

  it.each([
    ['returns an error', 'error'],
    ['throws (no service role)', 'throw'],
  ] as const)('the claim query %s: 2xx, no send, logged', async (_l, mode) => {
    h.ledger!.claimFailure = mode
    expect(await deliver('evt_E')).toBe(200)
    expect(sendCancelled).not.toHaveBeenCalled()
    expect(stripeCalls.update).toBe(0)
    const err = logs.error.mock.calls.flat().join(' ')
    expect(err).toContain('[email-ledger] claim failed; not sending: event=evt_E template=subscription-cancelled sub_1')
    // Stripe's retry after the database recovers sends exactly once.
    h.ledger!.claimFailure = null
    expect(await deliver('evt_E')).toBe(200)
    expect(sendCancelled).toHaveBeenCalledTimes(1)
  })

  it('every webhook-driven email goes through the ledger (source scan)', () => {
    const src = path.resolve(__dirname, '../../../..')
    const read = (f: string) => readFileSync(path.join(src, f), 'utf8')
    const route = read('app/api/webhooks/stripe/route.ts')
    // The route's only email path is the cancel notice; the modules it calls send no email.
    expect(route).not.toMatch(/@\/lib\/email\/(send|mailer|index)'|sendMail\(/)
    for (const f of ['lib/outreach/server.ts', 'lib/website-access.ts', 'lib/stripe/server.ts']) {
      expect(read(f)).not.toMatch(/@\/lib\/email|sendMail\(|send[A-Z]\w*Email\(/)
    }
    const notice = read('lib/email/cancel-notice.ts')
    expect(notice).toMatch(/sendWebhookEmailOnce\(eventId, CANCEL_EMAIL_TEMPLATE/)
    expect(notice.match(/sendSubscriptionCancelledEmail\(/g)).toHaveLength(1)
  })
})
