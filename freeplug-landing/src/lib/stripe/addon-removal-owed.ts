// L-1 (Aria, Oct 4 9:57 AM CT): a customer must never be charged for an add-on they turned off.
// Pure logic (no Supabase, no email transport): the store and the alert are passed in. Relative imports
// on purpose (change-plan.ts is loaded by scripts through jiti).
import type Stripe from 'stripe'
import { ADDONS, type AddonId } from '../plans/ladder'
import { addonOfPrice } from '../plans/addons'
import { addonNameList } from '../plans/ladder-copy'
import { ADDON_REFUNDED_META, ADDON_TURNED_OFF_META } from './addon-refund-info'
import { refundAddonCharge } from './change-plan'

/**
 * An upgrade releases the schedule that held a pending add-on removal and then puts the removal back on
 * the new step. When that keeps failing (3 tries), the removal is OWED: saved on our side
 * (addon_removals_owed), an internal alert goes to us, and the invoice.paid self-heal removes the item
 * and refunds what the renewal billed for it, once.
 */
export type RemovalOwedInput = {
  subscriptionId: string
  customerId: string | null
  userId: string | null
  addons: AddonId[]
  /** When it should have ended (the period end the removal was scheduled for), ISO. */
  effectiveAt: string
}
export type RemovalOwed = RemovalOwedInput & { id: string; source?: 'upgrade' | 'resume' }
export type RemovalOwedClear = 'refunded' | 'not_billed' | 'kept'
export type RemovalOwedStore = {
  /** One open row per subscription: a second save merges the add-ons. */
  save(o: RemovalOwedInput): Promise<void>
  open(subscriptionId: string): Promise<RemovalOwed[]>
  clear(id: string, how: RemovalOwedClear, invoiceId: string | null): Promise<void>
  /** The customer chose Keep it for this add-on: it is no longer owed (an emptied row is cleared 'kept'). */
  keep(subscriptionId: string, addon: AddonId): Promise<void>
}

export { REMOVAL_RESCHEDULE_BACKOFF_MS, REMOVAL_RESCHEDULE_TRIES, withRetries } from './retry'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Internal alert (to us, not the customer): plain text, no customer copy. */
export function removalOwedAlert(o: RemovalOwedInput): { subject: string; text: string } {
  return {
    subject: `[Freeplug billing] Add-on removal owed on ${o.subscriptionId}`,
    text: [
      'An upgrade could not put back a pending add-on removal after 3 tries.',
      `Subscription: ${o.subscriptionId}`,
      `Customer: ${o.customerId ?? 'unknown'}`,
      `User: ${o.userId ?? 'unknown'}`,
      `Add-ons the customer turned off: ${o.addons.join(', ')}`,
      `Should have ended: ${o.effectiveAt}`,
      '',
      'Saved in addon_removals_owed. On the renewal invoice.paid the self-heal removes the item and refunds its line once.',
      'If you fix it by hand first (remove the item in Stripe), the self-heal clears the row with nothing to refund.',
    ].join('\n'),
  }
}

/**
 * Vera L-1 (QA de173c8): the put-back failed, the owed flag could NOT be saved, AND the undo (set to end
 * again) failed. Nothing on our side will stop the add-on renewing, so this alert is the record: it goes to
 * the support inbox even when the database is down (sent directly, not through the email ledger).
 */
export type RemovalOwedUnrecorded = RemovalOwedInput & {
  /** A put-back schedule still attached to the subscription (release it before any other change). */
  scheduleId: string | null
  putBackError: string
  undoError: string
}

export const removalOwedUnrecordedSubject = (subscriptionId: string) =>
  `[Freeplug billing] Add-on removal owed on ${subscriptionId} (NOT SAVED, fix by hand)`

export function removalOwedUnrecordedAlert(o: RemovalOwedUnrecorded): { subject: string; text: string } {
  return {
    subject: removalOwedUnrecordedSubject(o.subscriptionId),
    text: [
      'Resume could not put back a pending add-on removal (3 tries), the owed flag could NOT be saved, and setting the plan to end again also failed.',
      'The plan is ON and nothing on our side will stop the add-on below from renewing. Fix it by hand.',
      '',
      `Subscription: ${o.subscriptionId}`,
      `Customer: ${o.customerId ?? 'unknown'}`,
      `User: ${o.userId ?? 'unknown'}`,
      `Add-ons the customer turned off: ${o.addons.join(', ')}`,
      `Should have ended: ${o.effectiveAt}`,
      `Schedule still attached: ${o.scheduleId ?? 'none'}`,
      `Put-back error: ${o.putBackError}`,
      `Undo error: ${o.undoError}`,
      '',
      'To recover:',
      `1. If a schedule is still attached (${o.scheduleId ?? 'none'}), release it in Stripe.`,
      `2. Remove ${o.addons.join(' and ')} from ${o.subscriptionId} with no proration, or schedule the removal for ${o.effectiveAt}.`,
      '3. If a renewal already billed it, refund that line with a credit note (memo: the turned_off reason).',
      `4. Or insert the addon_removals_owed row (source resume, effective_at ${o.effectiveAt}) and the next renewal self-heal does steps 2-3.`,
    ].join('\n'),
  }
}

/** Save the flag first (it is what stops the charge), then alert. Never throws. */
export async function recordRemovalOwed(
  deps: { store: RemovalOwedStore; alert: (o: RemovalOwedInput) => Promise<unknown>; log?: (m: string) => void },
  o: RemovalOwedInput
): Promise<{ saved: boolean; alerted: boolean }> {
  const log = deps.log ?? ((m: string) => console.error(m))
  let saved = false
  try {
    await deps.store.save(o)
    saved = true
    log(`[removal-owed] SAVED ${o.subscriptionId}: ${o.addons.join(',')} owed from ${o.effectiveAt}`)
  } catch (e) {
    log(`[removal-owed] FLAG NOT SAVED for ${o.subscriptionId} (${o.addons.join(',')}): ${errMsg(e)}`)
  }
  let alerted = false
  try {
    await deps.alert(o)
    alerted = true
  } catch (e) {
    log(`[removal-owed] alert failed for ${o.subscriptionId}: ${errMsg(e)}`)
  }
  return { saved, alerted }
}

type LineLike = {
  amount?: number | null
  price?: { id?: string; lookup_key?: string | null; product?: string | { id: string } | null } | null
  pricing?: { price_details?: { price?: string | null; product?: string | null } | null } | null
}
type InvoiceLike = {
  id?: string
  billing_reason?: string | null
  created?: number
  amount_paid?: number | null
  metadata?: Record<string, string> | null
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null
  lines?: { data?: readonly LineLike[] | null; has_more?: boolean } | null
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : (v?.id ?? null))
const subscriptionOf = (inv: InvoiceLike) =>
  idOf(inv.parent?.subscription_details?.subscription ?? null) ?? idOf((inv as { subscription?: string | { id: string } | null }).subscription ?? null)

/** The add-on an invoice line bills (the price object on older API versions, the product id on newer). */
export function addonOfInvoiceLine(line: LineLike): AddonId | null {
  const fromPrice = addonOfPrice(line.price as Parameters<typeof addonOfPrice>[0])
  if (fromPrice) return fromPrice.id
  const product = line.pricing?.price_details?.product
  return (product && ADDONS.find((a) => a.productId === product)?.id) || null
}

/** A renewal created up to an hour before the owed date still counts as that renewal (clock skew). */
const DUE_SLACK_MS = 60 * 60 * 1000

export type OwedHealResult =
  | { outcome: 'none' }
  | { outcome: 'not_due' }
  | { outcome: 'refunded' | 'already_refunded' | 'not_billed'; invoiceId: string; addons: AddonId[]; cardCents: number; creditCents: number }
  | { outcome: 'retry'; reason: string }

export type OwedHealDeps = {
  stripe: Stripe
  store: RemovalOwedStore
  log?: (m: string) => void
  /** The customer is told why (same refund email path as the other self-heal refunds; once per invoice). */
  notifyRefund?: (invoiceId: string) => Promise<unknown>
  /** Clock for the refund-time mark (tests: the simulated clock). */
  now?: () => Date
}

/**
 * invoice.paid, a renewal (subscription_cycle): for each removal owed on that subscription that is due,
 *   1. remove the add-on items still on the subscription (proration none: nothing else changes);
 *   2. refund what this renewal billed for those add-ons, ONCE (credit note: card first, then account
 *      credit; invoice marked addon_refunded + addon_turned_off_refunded; a redelivery finds the marks
 *      or the credit note and refunds nothing more);
 *   3. clear the flag (refunded / not_billed) and tell the customer (refund note + email).
 * Anything that fails leaves the flag open and answers 'retry' (the route asks Stripe to redeliver).
 */
export async function healOwedRemovals(deps: OwedHealDeps, inv: InvoiceLike): Promise<OwedHealResult> {
  const log = deps.log ?? ((m: string) => console.error(m))
  if (inv.billing_reason !== 'subscription_cycle' || !inv.id) return { outcome: 'none' }
  const subId = subscriptionOf(inv)
  if (!subId) return { outcome: 'none' }
  const rows = await deps.store.open(subId)
  if (rows.length === 0) return { outcome: 'none' }
  const createdMs = (inv.created ?? 0) * 1000
  const due = rows.filter((r) => createdMs >= Date.parse(r.effectiveAt) - DUE_SLACK_MS)
  if (due.length === 0) return { outcome: 'not_due' }
  const owed = [...new Set(due.flatMap((r) => r.addons))]
  const invoiceId = inv.id
  try {
    // 1. The items go (fresh read; nothing to do when they are already gone).
    const sub = await deps.stripe.subscriptions.retrieve(subId)
    const stale = (sub.items?.data ?? []).filter((i) => {
      const a = addonOfPrice(i.price as Parameters<typeof addonOfPrice>[0])
      return a && owed.includes(a.id)
    })
    if (stale.length > 0 && (sub.status === 'active' || sub.status === 'trialing')) {
      await deps.stripe.subscriptions.update(
        subId,
        { items: stale.map((i) => ({ id: i.id, deleted: true })), proration_behavior: 'none' },
        { idempotencyKey: `owed-remove:${subId}:${invoiceId}` }
      )
      log(`[removal-owed] removed ${stale.length} owed add-on item(s) from ${subId}`)
    }
    // 2. What this renewal billed for them (fresh invoice: the event copy may be stale or truncated).
    const fresh = (await deps.stripe.invoices.retrieve(invoiceId)) as unknown as InvoiceLike
    let lines: readonly LineLike[] = fresh.lines?.data ?? []
    if (fresh.lines?.has_more) {
      const all = await deps.stripe.invoices.listLineItems(invoiceId, { limit: 100 })
      lines = all.data as unknown as LineLike[]
    }
    const billed = new Map<AddonId, number>()
    for (const l of lines) {
      const a = addonOfInvoiceLine(l)
      if (a && owed.includes(a) && (l.amount ?? 0) > 0) billed.set(a, (billed.get(a) ?? 0) + (l.amount ?? 0))
    }
    const cents = [...billed.values()].reduce((n, c) => n + c, 0)
    const billedIds = owed.filter((a) => billed.has(a))
    let outcome: 'refunded' | 'already_refunded' | 'not_billed' = 'not_billed'
    let cardCents = 0
    let creditCents = 0
    if (cents > 0) {
      const wasMarked = !!(fresh.metadata ?? {})[ADDON_REFUNDED_META]
      const r = await refundAddonCharge(deps.stripe, invoiceId, fresh.amount_paid ?? 0, cents, log, 'turned_off', {
        extraMarks: { [ADDON_TURNED_OFF_META]: billedIds.join(',') },
        addonName: addonNameList(billedIds),
        now: deps.now?.(),
      })
      if (!r.ok) return { outcome: 'retry', reason: 'refund_failed' }
      outcome = wasMarked ? 'already_refunded' : 'refunded'
      cardCents = r.cardCents
      creditCents = r.creditCents
    }
    // 3. The flag clears only after the item is gone and the money is back.
    for (const row of due) await deps.store.clear(row.id, cents > 0 ? 'refunded' : 'not_billed', invoiceId)
    log(`[removal-owed] ${subId} ${invoiceId}: ${outcome} (${billedIds.join(',') || 'nothing billed'}; ${cardCents} card, ${creditCents} credit); flag cleared`)
    if (cents > 0 && deps.notifyRefund) {
      try {
        await deps.notifyRefund(invoiceId)
      } catch (e) {
        log(`[removal-owed] ${invoiceId}: refund notice failed (${errMsg(e)})`)
      }
    }
    return { outcome, invoiceId, addons: billedIds, cardCents, creditCents }
  } catch (e) {
    log(`[removal-owed] heal failed on ${subId} ${invoiceId}: ${errMsg(e)}`)
    return { outcome: 'retry', reason: errMsg(e) }
  }
}
