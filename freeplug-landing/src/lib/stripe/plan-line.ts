import { stepByLookupKey } from '../plans/ladder'

/** Whole dollars like the step rows ("$65"); cents only when they are not zero ("$65.50"). */
export function formatPlanDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

export type PlanLineItem = { lookupKey: string | null; productName: string; unitAmountCents: number; quantity: number }

/**
 * The Plans page strip line for one live subscription (round 5, Sable/Lina): "<Name> · $65/month".
 * A ladder plan is named by its step ("Fast lane"), never the product name ("Freeplug Hosting: Fast
 * lane"), so the strip doesn't read "Current plan: Freeplug Hosting: …". Grandfathered plans keep
 * their product names joined with " + ". The status is added when it is not "active".
 */
export function planStripLine(items: ReadonlyArray<PlanLineItem>, interval: string, status: string): string {
  const step = items.length === 1 ? stepByLookupKey(items[0].lookupKey) : null
  const name = step ? step.name : items.map((i) => i.productName).join(' + ')
  const amount = items.reduce((sum, i) => sum + i.unitAmountCents * i.quantity, 0)
  const suffix = status === 'active' ? '' : ` (${status.replace(/_/g, ' ')})`
  return `${name} · ${formatPlanDollars(amount)}/${interval}${suffix}`
}
