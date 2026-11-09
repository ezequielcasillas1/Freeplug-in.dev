import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { OWNER_ALERT_KINDS, OWNER_ALERT_LABELS, renderOwnerAlert, type OwnerAlert } from './format'
import { ownerAlertRecipient, scheduleOwnerAlert, sendOwnerAlert, type OwnerAlertDeps } from './send'
import { ownerAlertForStripeEvent } from './stripe-events'

const TO = 'owner@example.com'
const BASE = 'https://freeplug-in.dev'
const sample = (kind: OwnerAlert['kind'], planName: string | null = 'Priority'): OwnerAlert => ({
  kind,
  customer: { name: 'Ana Ruiz', email: 'ana@example.com', business: 'Ruiz Auto', planName, weekendReplies: planName === 'Priority' },
  details: [['Amount', '$55.00']],
  at: new Date('2026-10-19T15:30:00Z'),
})

function deps(over: Partial<OwnerAlertDeps> = {}) {
  const sendMail = vi.fn(async () => ({ success: true as const, id: 'em_1' }))
  const seen = new Set<string>()
  const sendWebhookEmailOnce = vi.fn(async (id: string, template: string, _l: string, send: () => Promise<unknown>) => {
    if (seen.has(`${id}:${template}`)) return 'skipped' as const
    seen.add(`${id}:${template}`)
    await send()
    return 'sent' as const
  })
  return { sendMail, sendWebhookEmailOnce, ...over } as unknown as OwnerAlertDeps & { sendMail: ReturnType<typeof vi.fn> }
}

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_APP_URL', BASE))
afterEach(() => vi.unstubAllEnvs())

describe('owner alerts: one alert per event with the right subject', () => {
  it.each(OWNER_ALERT_KINDS)('%s -> "<Event>: <name> (<plan>)" and one send', async (kind) => {
    vi.stubEnv('OWNER_ALERT_EMAIL', TO)
    const d = deps()
    expect(await sendOwnerAlert(sample(kind), { dedupeKey: `k-${kind}` }, d)).toBe('sent')
    expect(d.sendMail).toHaveBeenCalledTimes(1)
    const p = d.sendMail.mock.calls[0][0]
    expect(p.to).toBe(TO)
    expect(p.subject).toBe(`${OWNER_ALERT_LABELS[kind]}: Ana Ruiz (Priority)`)
    expect(p.idempotencyKey).toBe(`owner-alert:k-${kind}`)
    expect(p.replyTo).toBeNull()
  })

  it('body: customer, plan with weekend replies, details, Chicago time, admin link; red line only when it needs attention', () => {
    const r = renderOwnerAlert({ ...sample('refund'), adminPath: '/admin/requests' }, BASE)
    expect(r.text).toMatch(/^NEEDS ATTENTION/)
    expect(r.html).toContain('Needs attention')
    for (const s of ['Ana Ruiz', 'ana@example.com', 'Ruiz Auto', 'Priority (gets weekend replies)', 'Amount: $55.00', 'Oct 19, 2026', '10:30 AM CT', 'Open in admin: https://freeplug-in.dev/admin/requests'])
      expect(r.text).toContain(s)
    const plain = renderOwnerAlert(sample('signup', 'Starter'), BASE)
    expect(plain.text).not.toContain('NEEDS ATTENTION')
    expect(plain.text).toContain('Plan: Starter\n')
    expect(renderOwnerAlert(sample('signup', null), BASE).subject).toBe('New signup: Ana Ruiz')
  })

  it('escapes HTML from customer input', () => {
    const r = renderOwnerAlert({ ...sample('change_request'), details: [['Change', '<script>x</script>']] }, BASE)
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
  })
})

describe('owner alerts: recipient and failures', () => {
  it('unset or invalid OWNER_ALERT_EMAIL -> no alert, nothing sent', async () => {
    for (const v of ['', 'not-an-email', 'a@b.com,c@d.com']) {
      vi.stubEnv('OWNER_ALERT_EMAIL', v)
      const d = deps()
      expect(ownerAlertRecipient()).toBeNull()
      expect(await sendOwnerAlert(sample('signup'), { dedupeKey: 'x' }, d)).toBe('disabled')
      expect(d.sendMail).not.toHaveBeenCalled()
    }
  })

  it('a send that fails or throws never throws to the caller', async () => {
    vi.stubEnv('OWNER_ALERT_EMAIL', TO)
    const failing = deps({ sendMail: vi.fn(async () => ({ success: false as const, error: 'x', reason: 'http' as const, status: 500 })) })
    expect(await sendOwnerAlert(sample('signup'), { dedupeKey: 'a' }, failing)).toBe('failed')
    const throwing = deps({ sendMail: vi.fn(async () => { throw new Error('boom') }) })
    await expect(sendOwnerAlert(sample('signup'), { dedupeKey: 'b' }, throwing)).resolves.toBe('failed')
  })

  it('scheduleOwnerAlert: a failing build never reaches the action', async () => {
    vi.stubEnv('OWNER_ALERT_EMAIL', TO)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => scheduleOwnerAlert('t', async () => { throw new Error('db down') })).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('webhook retries: the same Stripe event id sends once', async () => {
    vi.stubEnv('OWNER_ALERT_EMAIL', TO)
    const d = deps()
    expect(await sendOwnerAlert(sample('refund'), { dedupeKey: 'evt_1', stripeEventId: 'evt_1' }, d)).toBe('sent')
    expect(await sendOwnerAlert(sample('refund'), { dedupeKey: 'evt_1', stripeEventId: 'evt_1' }, d)).toBe('skipped')
    expect(d.sendMail).toHaveBeenCalledTimes(1)
    expect(d.sendWebhookEmailOnce).toHaveBeenCalledWith('evt_1', 'owner-alert', 'refund', expect.any(Function))
  })
})

const ev = (type: string, object: object, previous_attributes?: object) =>
  ({ type, data: { object, ...(previous_attributes ? { previous_attributes } : {}) } }) as unknown as Stripe.Event
const items = (step: string) => ({ data: [{ price: { lookup_key: `freeplug_step_${step}_monthly` } }] })

describe('owner alerts: Stripe event -> alert kind', () => {
  it.each([
    [ev('customer.subscription.created', { customer: 'cus_1', status: 'active', items: items('priority') }), 'plan_purchased'],
    [ev('customer.subscription.created', { customer: 'cus_1', status: 'incomplete', items: items('priority') }), null],
    [ev('customer.subscription.updated', { customer: 'cus_1', status: 'active', items: items('priority') }, { status: 'incomplete' }), 'plan_purchased'],
    [ev('customer.subscription.updated', { customer: 'cus_1', status: 'active', items: items('fast_lane') }, { items: items('priority') }), 'plan_upgraded'],
    [ev('customer.subscription.updated', { customer: 'cus_1', status: 'active', items: items('starter') }, { items: items('priority') }), 'plan_downgraded'],
    [ev('customer.subscription.updated', { customer: 'cus_1', status: 'active', cancel_at_period_end: true, items: items('starter') }, { cancel_at_period_end: false }), 'plan_canceled'],
    [ev('customer.subscription.updated', { customer: 'cus_1', status: 'past_due', items: items('starter') }, { status: 'active' }), 'payment_failed'],
    [ev('customer.subscription.updated', { customer: 'cus_1', status: 'active', items: items('starter') }, { current_period_end: 1 }), null],
    [ev('customer.subscription.deleted', { customer: 'cus_1', status: 'canceled', items: items('starter') }), 'plan_canceled'],
    [ev('invoice.paid', { customer: 'cus_1', amount_paid: 7500, metadata: { maintenance_quote_id: 'q1' } }), 'maintenance_quote_paid'],
    [ev('invoice.paid', { customer: 'cus_1', amount_paid: 3500, metadata: {} }), null],
    [ev('refund.created', { amount: 3500, charge: 'ch_1', reason: 'requested_by_customer' }), 'refund'],
    [ev('refund.failed', { amount: 3500, charge: 'ch_1' }), 'refund_failed'],
    [ev('charge.refunded', { amount: 3500 }), null],
    [ev('charge.dispute.created', { amount: 3500, charge: 'ch_1', reason: 'fraudulent' }), 'dispute_opened'],
    [ev('charge.dispute.updated', { amount: 3500, charge: 'ch_1' }), null],
    [ev('charge.dispute.closed', { amount: 3500, charge: 'ch_1', status: 'lost' }), 'dispute_closed'],
  ] as const)('%#', (event, kind) => {
    expect(ownerAlertForStripeEvent(event)?.kind ?? null).toBe(kind)
  })

  it('upgrade details name both plans; no card data in details', () => {
    const a = ownerAlertForStripeEvent(ev('customer.subscription.updated', { customer: 'cus_1', status: 'active', items: items('fast_lane') }, { items: items('priority') }))!
    expect(a.details).toEqual([['From', 'Priority ($55.00/mo)'], ['To', 'Fast lane ($65.00/mo)']])
    expect(JSON.stringify(a)).not.toMatch(/last4|card|pm_/)
  })
})
