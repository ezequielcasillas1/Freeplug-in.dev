import type { AddonId, Entitlements } from '@/lib/plans/ladder'
import type { ChangeType } from '@/lib/help/help-chat-content'

/**
 * billing (Aria spec, item 3), decided by the server, never by the customer:
 *   included   = the allowance (plan step + any add-on) still has a use left this billing period
 *   paid_addon = no use left AND they don't have the matching add-on yet ($5 +1 small edit /
 *                $5.75 Big change), so the add-on is the paid route (Aria ruling 4, Oct 4)
 *   (allowance used up but they already have that add-on: we can't tell what's next -> unknown)
 *   quote      = over an hour (maintenance $50-$100, quote first)
 *   unknown    = can't tell (no plan, a lookup failed, or the size of the change isn't known)
 */
export const CHANGE_BILLING = ['included', 'paid_addon', 'quote', 'unknown'] as const
export type ChangeBilling = (typeof CHANGE_BILLING)[number]

/** How big a change is: small edit, Big change (up to about an hour), or over an hour. */
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
  entitlements: Pick<Entitlements, 'step' | 'legacy' | 'includedEditsPerMonth' | 'bigChangesPerMonth' | 'addons'> | null
  /** Uses already recorded this billing period; null = unknown (no active period or a read error). */
  smallEditsUsed: number | null
  bigChangesUsed: number | null
}

export function classifyChangeBilling(input: BillingInput): ChangeBilling {
  if (input.size === 'over_hour') return 'quote'
  const ent = input.entitlements
  if (!input.size || !ent || (!ent.step && !ent.legacy)) return 'unknown'
  const [allowed, used, addon]: [number, number | null, AddonId] =
    input.size === 'small'
      ? [ent.includedEditsPerMonth, input.smallEditsUsed, 'small_edit']
      : [ent.bigChangesPerMonth, input.bigChangesUsed, 'big_change']
  if (used === null || !Number.isFinite(used) || !Number.isFinite(allowed) || !Array.isArray(ent.addons)) return 'unknown'
  if (Math.max(0, allowed) - Math.max(0, used) > 0) return 'included'
  return ent.addons.includes(addon) ? 'unknown' : 'paid_addon'
}
