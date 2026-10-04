// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ sends: [] as unknown[][], claimed: new Set<string>() }))
vi.mock('@/lib/email/send', () => ({
  sendAddonRefundedEmail: async (...a: unknown[]) => {
    h.sends.push(a)
    return { success: true }
  },
}))
vi.mock('@/lib/email/webhook-email-ledger', () => ({
  sendWebhookEmailOnce: async (key: string, template: string, _label: string, send: () => Promise<unknown>) => {
    if (h.claimed.has(`${key}|${template}`)) return 'skipped'
    h.claimed.add(`${key}|${template}`)
    await send()
    return 'sent'
  },
}))

import type Stripe from 'stripe'
import { sendAddonRefundNoticeOnce } from './addon-refund-notice'
import { render, toPlainText } from '@react-email/components'
import { AddonRefundedEmail } from './templates/addon-refunded'

const inv = (metadata: Record<string, string>, customer: string | null = 'cus_1') => ({ id: 'in_1', customer, total: 575, amount_paid: 575, metadata })
const refunded = { freeplug_kind: 'addon_first_period', addon: 'big_change', addon_refunded: 'true', addon_refund_reason: 'tip_unconfirmed', addon_refund_card_cents: '575', addon_refund_credit_cents: '0' }
const stripe = (i: unknown, email: string | null = 'dana@example.invalid', name: string | null = null) =>
  ({ invoices: { retrieve: async () => i }, customers: { retrieve: async () => ({ id: 'cus_1', email, name }) } }) as unknown as Pick<Stripe, 'invoices' | 'customers'>

describe('sendAddonRefundNoticeOnce (Aria 9:27: the email line, through the webhook email ledger)', () => {
  beforeEach(() => {
    h.sends = []
    h.claimed.clear()
  })
  it('a refunded add-on invoice: one email with the reason + split, keyed by the invoice; a second call is already_sent', async () => {
    expect(await sendAddonRefundNoticeOnce(stripe(inv(refunded)), 'in_1')).toBe('sent')
    expect(h.sends).toEqual([
      [
        'dana@example.invalid',
        { addonName: 'Big change', note: "We couldn't turn on Big change because it would have lowered your tip, which you hadn't confirmed. We refunded $5.75 to your card. The card refund can take 5–10 business days to show up." },
        { idempotencyKey: 'addon-refund:in_1:addon-refunded' },
      ],
    ])
    expect(await sendAddonRefundNoticeOnce(stripe(inv(refunded)), 'in_1')).toBe('already_sent')
    expect(h.sends).toHaveLength(1)
  })
  it('not refunded (or not an add-on charge): no email', async () => {
    expect(await sendAddonRefundNoticeOnce(stripe(inv({ ...refunded, addon_refunded: '' })), 'in_1')).toBe('not_refunded')
    expect(await sendAddonRefundNoticeOnce(stripe(inv({ freeplug_kind: 'other' })), 'in_1')).toBe('not_refunded')
    expect(h.sends).toHaveLength(0)
  })
  it('no customer email: no_email, never throws', async () => {
    expect(await sendAddonRefundNoticeOnce(stripe(inv(refunded), null), 'in_1')).toBe('no_email')
    expect(await sendAddonRefundNoticeOnce(stripe(inv(refunded, null)), 'in_1')).toBe('no_email')
    expect(h.sends).toHaveLength(0)
  })
  it('Sable 10:01: the L-1 refund (a turned-off add-on still on the renewal) uses its own subject; other refunds keep the default', async () => {
    const l1 = { addon_refunded: 'true', addon_turned_off_refunded: 'big_change', addon_refund_card_cents: '575', addon_refund_credit_cents: '0' }
    expect(await sendAddonRefundNoticeOnce(stripe(inv(l1)), 'in_1')).toBe('sent')
    expect(h.sends[0][1]).toEqual({
      addonName: 'Big change',
      subject: 'We refunded your Big change charge.',
      note: 'You turned off Big change, but it was still charged this period. We refunded $5.75 to your card. The card refund can take 5–10 business days to show up.',
    })
    h.claimed.clear()
    expect(await sendAddonRefundNoticeOnce(stripe(inv(refunded)), 'in_1')).toBe('sent')
    expect(h.sends[1][1]).not.toHaveProperty('subject')
  })
  it('Vera L-2: "Hi {userName}," with the Stripe customer name; "Hi," only when there is no name (or it is blank)', async () => {
    expect(await sendAddonRefundNoticeOnce(stripe(inv(refunded), 'dana@example.invalid', '  Dana Ruiz '), 'in_1')).toBe('sent')
    expect(h.sends[0][1]).toMatchObject({ userName: 'Dana Ruiz', addonName: 'Big change' })
    const named = toPlainText(await render(AddonRefundedEmail(h.sends[0][1] as Parameters<typeof AddonRefundedEmail>[0])))
    expect(named).toContain('Hi Dana Ruiz,')
    for (const name of [null, '', '   ']) {
      h.claimed.clear()
      h.sends = []
      expect(await sendAddonRefundNoticeOnce(stripe(inv(refunded), 'dana@example.invalid', name), 'in_1')).toBe('sent')
      expect(h.sends[0][1]).not.toHaveProperty('userName')
      const plain = toPlainText(await render(AddonRefundedEmail(h.sends[0][1] as Parameters<typeof AddonRefundedEmail>[0])))
      expect(plain).toMatch(/(^|\n)Hi,/)
      expect(plain).not.toMatch(/Hi [A-Za-z]/)
    }
  })
})
