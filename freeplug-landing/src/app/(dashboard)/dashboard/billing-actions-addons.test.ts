// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Add-on server actions (Plans page): Sable's final strings (Oct 4 9:05 AM CT) for every add-on result,
 * the lock line with the switch date from the schedule (Aria 8:59, ruling 1), the real amount and the
 * "up to" fallback (ruling 2b), and the self-heal "finishing" result (ruling 2d). The change functions
 * themselves are tested in change-plan-addons.test.ts / addon-heal.test.ts; here they are stubbed.
 */
const h = vi.hoisted(() => ({
  preview: null as unknown,
  previewThrows: false,
  change: null as unknown,
  notice: (async () => 'sent') as (...a: unknown[]) => Promise<unknown>,
  keep: vi.fn<(...a: unknown[]) => Promise<void>>(async () => undefined),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))
vi.mock('next/navigation', () => ({ redirect: (url: string) => Promise.reject(Object.assign(new Error('NEXT_REDIRECT'), { url })) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { stripe_customer_id: 'cus_1' }, error: null }) }) }) }),
  }),
}))
vi.mock('@/lib/stripe/active-subscription', async (orig) => ({
  ...(await orig<typeof import('@/lib/stripe/active-subscription')>()),
  listLiveSubscriptions: async () => [{ id: 'sub_1', status: 'active', items: { data: [] } }],
}))
vi.mock('@/lib/rate-limit', () => ({ PLAN_PREVIEW_LIMIT: {}, rateCheck: async () => true }))
vi.mock('@/lib/stripe/server', () => ({ getStripe: () => ({}) }))
vi.mock('@/lib/stripe/prices', () => ({ getAddonPriceId: async (id: string) => `price_${id}` }))
vi.mock('@/lib/plans/plan-change-lock-server', () => ({
  planChangeLockStore: () => ({ claim: async () => 'claim-1', release: async () => undefined }),
}))
vi.mock('@/lib/stripe/addon-removal-owed-server', () => ({
  recordRemovalOwedNow: () => async () => ({ saved: true, alerted: true }),
  sendRemovalOwedUnrecordedAlert: async () => undefined,
  resumeRemovalOwed: async () => ({ addons: [], effectiveAt: null }),
  removalOwedStore: () => ({ keep: (...a: unknown[]) => h.keep(...a) }),
}))
vi.mock('@/lib/email/addon-refund-notice', () => ({ sendAddonRefundNoticeOnce: (...a: unknown[]) => h.notice(...a) }))
vi.mock('@/lib/stripe/change-plan', async (orig) => ({
  ...(await orig<typeof import('@/lib/stripe/change-plan')>()),
  previewAddonChange: async () => {
    if (h.previewThrows) throw new Error('stripe down')
    return h.preview
  },
  changeAddon: async () => h.change,
}))

import { changeAddonAction, previewAddonChangeAction } from './billing-actions'

describe('L-1 (Aria 9:57): Keep it drops an owed removal for that add-on', () => {
  it('kept: the owed flag for that add-on is cleared; a store error never changes the message', async () => {
    h.keep.mockClear()
    h.change = { ok: true, kind: 'kept', addon: 'big_change', effectiveAt: null }
    expect(await changeAddonAction('big_change', 'keep')).toEqual({ ok: true, message: 'Big change stays on.' })
    expect(h.keep).toHaveBeenCalledWith('sub_1', 'big_change')
    h.keep.mockRejectedValueOnce(new Error('db down'))
    expect(await changeAddonAction('big_change', 'keep')).toEqual({ ok: true, message: 'Big change stays on.' })
  })
})

describe('Aria 9:27: a refund on Confirm also sends the email (once per invoice, through the ledger)', () => {
  it('not_applied + refunded: the notice is sent for that invoice; a notice failure never changes the message', async () => {
    h.notice = vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => 'sent')
    h.change = { ok: false, code: 'not_applied', message: 'x', refunded: true, refundCardCents: 500, refundCreditCents: 0, invoiceId: 'in_7' }
    expect(await changeAddonAction('small_edit', 'on')).toMatchObject({ ok: false, message: expect.stringContaining('We refunded $5 to your card.') })
    expect(h.notice).toHaveBeenCalledWith(expect.anything(), 'in_7')
    h.notice = vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => Promise.reject(new Error('resend down')))
    expect(await changeAddonAction('small_edit', 'on')).toMatchObject({ ok: false, message: expect.stringContaining('We refunded $5 to your card.') })
  })
  it('no refund (it failed): no "we refunded" email', async () => {
    h.notice = vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => 'sent')
    h.change = { ok: false, code: 'not_applied', message: 'x', refunded: false, invoiceId: 'in_7' }
    await changeAddonAction('small_edit', 'on')
    expect(h.notice).not.toHaveBeenCalled()
  })
})

const SWITCH_AT = '2026-11-03T15:00:00.000Z'
beforeEach(() => {
  h.previewThrows = false
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('preview (turn on): the real amount, the lock line, the fallback', () => {
  it('passes the real amount and the full price through', async () => {
    h.preview = { ok: true, action: 'on', addon: 'big_change', prorationDate: 100, amountDueCents: 375, fullCents: 575, currency: 'usd', nextAmountCents: 6075, nextBillingAt: SWITCH_AT, tipDollarsNow: 0, tipDollarsAfter: 0 }
    expect(await previewAddonChangeAction('big_change', 'on')).toEqual({
      ok: true, action: 'on', prorationDate: 100, amountDueCents: 375, fullCents: 575, nextAmountCents: 6075, nextDate: 'November 3, 2026', tipDollarsNow: 0, tipDollarsAfter: 0,
    })
  })
  it('a plan switch pending: "You can change add-ons after your switch on {date}." with the schedule date', async () => {
    h.preview = { ok: false, code: 'pending_switch', message: 'x', switchAt: SWITCH_AT }
    expect(await previewAddonChangeAction('small_edit', 'on')).toEqual({ ok: false, message: 'You can change add-ons after your switch on November 3, 2026.', prorationDate: null })
  })
  it('an add-on set to end / a grandfathered plan: Sable 9:05 lines', async () => {
    h.preview = { ok: false, code: 'pending_addons', message: 'x' }
    expect((await previewAddonChangeAction('small_edit', 'on')).ok).toBe(false)
    expect(await previewAddonChangeAction('small_edit', 'on')).toMatchObject({ message: 'An add-on is set to end. Choose Keep it, or wait until it ends to make other changes.' })
    h.preview = { ok: false, code: 'no_addon_plan', message: 'x' }
    expect(await previewAddonChangeAction('small_edit', 'on')).toMatchObject({ message: "Add-ons aren't available on your plan. To use them, switch to one of the plans above." })
  })
  it('the Stripe preview fails: a fallback ("up to" the full price) with the proration date', async () => {
    h.previewThrows = true
    const r = await previewAddonChangeAction('big_change', 'on')
    expect(r).toMatchObject({ ok: false, fallback: { priceCents: 575 } })
    expect(r.ok === false && typeof r.prorationDate === 'number').toBe(true)
    // turning off has no fallback (nothing is charged)
    expect(await previewAddonChangeAction('big_change', 'off')).toEqual({ ok: false, message: "We couldn't change your add-ons right now. Try again, or email support@freeplug-in.dev.", prorationDate: null })
  })
})

describe("Confirm: Sable's final result lines, word for word", () => {
  it.each([
    [{ ok: true, kind: 'on', addon: 'small_edit', tipDollars: 0, invoiceStatus: 'paid', invoiceId: 'in_1' }, 'small_edit', { ok: true, message: '+1 small edit is on.' }],
    [{ ok: true, kind: 'removal_scheduled', addon: 'big_change', effectiveAt: SWITCH_AT }, 'big_change', { ok: true, message: 'Big change ends November 3, 2026.' }],
    [{ ok: true, kind: 'kept', addon: 'big_change', effectiveAt: null }, 'big_change', { ok: true, message: 'Big change stays on.' }],
    [{ ok: false, code: 'payment_failed', message: 'x' }, 'small_edit', { ok: false, message: "Your card wasn't charged, so +1 small edit is still off. Update your card in Manage billing, then try again." }],
    [{ ok: false, code: 'finishing', message: 'x', invoiceId: 'in_1' }, 'big_change', { ok: false, code: 'finishing', message: "Your payment went through. We're finishing turning on Big change. Refresh in a moment to see it. If it can't be added, we'll refund the charge automatically." }],
    [{ ok: false, code: 'not_applied', message: 'x', refunded: true, refundCardCents: 500, refundCreditCents: 0, invoiceId: 'in_9' }, 'small_edit', { ok: false, message: "We couldn't turn on +1 small edit. We refunded $5 to your card. The card refund can take 5–10 business days to show up." }],
    [{ ok: false, code: 'not_applied', message: 'x', refunded: true, refundCardCents: 0, refundCreditCents: 575, invoiceId: 'in_9' }, 'big_change', { ok: false, message: "We couldn't turn on Big change. We added $5.75 back to your account credit." }],
    [{ ok: false, code: 'not_applied', message: 'x', refunded: true, refundCardCents: 35, refundCreditCents: 540, invoiceId: 'in_9' }, 'big_change', { ok: false, message: "We couldn't turn on Big change. We refunded $0.35 to your card and added $5.40 back to your account credit. The card refund can take 5–10 business days to show up." }],
    [{ ok: false, code: 'price_mismatch', message: 'x' }, 'big_change', { ok: false, message: "We couldn't confirm this price. Please try again, or email support@freeplug-in.dev and we'll help." }],
    [{ ok: true, kind: 'on', addon: 'big_change', tipDollars: 0, invoiceStatus: null, invoiceId: null, deferredCents: 35 }, 'big_change', { ok: true, message: 'Big change is on.' }],
    [{ ok: false, code: 'not_applied', message: 'x', refunded: false }, 'small_edit', { ok: false, message: "We couldn't turn on +1 small edit, and the refund didn't go through automatically. Email support@freeplug-in.dev and we'll sort out the charge." }],
    [{ ok: false, code: 'pending_switch', message: 'x', switchAt: SWITCH_AT }, 'small_edit', { ok: false, message: 'You can change add-ons after your switch on November 3, 2026.' }],
    [{ ok: false, code: 'not_on', message: 'x' }, 'small_edit', { ok: false, message: "We couldn't change your add-ons right now. Try again, or email support@freeplug-in.dev." }],
  ])('%#', async (result, id, expected) => {
    h.change = result
    expect(await changeAddonAction(id, (result as { kind?: string }).kind === 'kept' ? 'keep' : 'on')).toEqual(expected)
  })
})
