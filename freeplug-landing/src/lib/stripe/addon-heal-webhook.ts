import type Stripe from 'stripe'
import type { AddonId } from '../plans/ladder'
import { withPlanChangeLock, type PlanChangeLockStore } from '../plans/plan-change-lock'
import { ADDON_APPLIED_META, ADDON_FIRST_PERIOD_KIND, ADDON_REFUNDED_META, healAddonCharge, type AddonHealResult } from './change-plan'

/**
 * invoice.paid self-heal for the add-on first-period charge (Aria, Oct 4 8:59 AM CT).
 *
 * Runs under the SAME per-user change-plan lock the Plans page holds while it turns an add-on on, so
 * the webhook and the request never add the item at the same time, and two deliveries of the event
 * (Stripe retries, concurrent deliveries) run one after the other. The request usually still holds
 * the lock when the event lands: wait a few seconds for it; still held = 'retry' (the route answers
 * non-2xx so Stripe redelivers; a crashed request's lock expires after 60 s). No user id on the
 * charge: no lock (the fresh reads, the invoice markers and Stripe's idempotency key still stop a
 * second item).
 */
export type AddonHealWebhookDeps = {
  stripe: Stripe
  addonPriceIdFor: (id: AddonId) => Promise<string>
  lockStore: PlanChangeLockStore | null
  log?: (msg: string) => void
  now?: () => Date
  /** How long to wait for a held lock (default 8 s, polled every 500 ms). */
  lockWaitMs?: number
  sleep?: (ms: number) => Promise<void>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isAddonChargeInvoice = (inv: Pick<Stripe.Invoice, 'metadata'>) => inv.metadata?.freeplug_kind === ADDON_FIRST_PERIOD_KIND

export async function healAddonChargeFromWebhook(deps: AddonHealWebhookDeps, inv: Pick<Stripe.Invoice, 'id' | 'metadata'>): Promise<AddonHealResult> {
  if (!isAddonChargeInvoice(inv) || !inv.id) return { outcome: 'not_addon' }
  const log = deps.log ?? ((m: string) => console.error(m))
  const run = () => healAddonCharge({ stripe: deps.stripe, addonPriceIdFor: deps.addonPriceIdFor, log, now: deps.now }, inv.id as string)
  // Already finished (the usual case for a retry or duplicate): answer from the fresh invoice, no lock.
  const fresh = await deps.stripe.invoices.retrieve(inv.id)
  const marks = (fresh.metadata ?? {}) as Record<string, string | undefined>
  if (marks[ADDON_APPLIED_META]) return { outcome: 'already_applied' }
  if (marks[ADDON_REFUNDED_META]) return { outcome: 'already_refunded' }
  const userId = fresh.metadata?.user_id ?? inv.metadata?.user_id ?? ''
  if (!deps.lockStore || !UUID.test(userId)) return run()
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const deadline = Date.now() + (deps.lockWaitMs ?? 8000)
  for (;;) {
    const lock = await withPlanChangeLock(deps.lockStore, userId, run, log)
    if (lock.ok) return lock.value
    if (lock.code === 'lock_error') return { outcome: 'retry', reason: 'lock_error' }
    if (Date.now() >= deadline) return { outcome: 'retry', reason: 'in_progress' }
    await sleep(500)
  }
}

/** Outcomes the route answers with a non-2xx (Stripe redelivers; every step is idempotent). */
export const healNeedsRedelivery = (r: AddonHealResult) => r.outcome === 'retry' || r.outcome === 'refund_failed'
