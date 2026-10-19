import type { Entitlements } from '@/lib/plans/ladder'
import type { ChangeType } from '@/lib/help/help-chat-content'

/**
 * billing (Aria spec, item 3), decided by the server, never by the customer:
 *   included   = the plan's edits (edit-allowance.ts) still have a use left this billing period
 *   paid_addon = no edit left this period: the $5 edit pack is the paid route (stored value kept;
 *                the old "+1 small edit" / "Big change" add-ons are retired, Oct 18)
 *   quote      = bigger than an edit (new pages, sections, features): one-time maintenance quote first
 *   unknown    = can't tell (no plan, a lookup failed, or the size of the change isn't known)
 */
export const CHANGE_BILLING = ['included', 'paid_addon', 'quote', 'unknown'] as const
export type ChangeBilling = (typeof CHANGE_BILLING)[number]

/** How big a change is: an edit, or bigger work ('big' / 'over_hour' both go to a maintenance quote). */
export type ChangeSize = 'small' | 'big' | 'over_hour'

/**
 * The Help chat only knows the change type. The three named types are small edits; "Something
 * else" could be any size, so it is unknown (nothing in the chat says a change is over an hour, so
 * the chat never produces `quote` today; the team sizes it).
 */
export function sizeOfChangeType(changeType: ChangeType | string): ChangeSize | null {
  if (changeType === 'Text or prices' || changeType === 'Photos' || changeType === 'Hours or contact info') return 'small'
  return null
}

export type BillingInput = {
  size: ChangeSize | null
  /** null = no plan found or the lookup failed. */
  entitlements: Pick<Entitlements, 'step' | 'legacy' | 'includedEditsPerMonth'> | null
  /** Uses already recorded this billing period; null = unknown (no active period or a read error). */
  smallEditsUsed: number | null
}

export function classifyChangeBilling(input: BillingInput): ChangeBilling {
  if (input.size === 'over_hour' || input.size === 'big') return 'quote'
  const ent = input.entitlements
  if (!input.size || !ent || (!ent.step && !ent.legacy)) return 'unknown'
  const allowed = ent.includedEditsPerMonth
  const used = input.smallEditsUsed
  if (used === null || !Number.isFinite(used) || Number.isNaN(allowed)) return 'unknown'
  if (allowed === Number.POSITIVE_INFINITY) return 'included'
  if (Math.max(0, allowed) - Math.max(0, used) > 0) return 'included'
  return 'paid_addon'
}
