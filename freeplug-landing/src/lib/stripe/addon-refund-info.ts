// Pure helpers (no Stripe calls): the add-on first-period charge's invoice metadata. Relative imports on
// purpose (change-plan.ts is loaded by scripts through jiti). Re-exported from change-plan.ts.
import { addonById, type AddonId } from '../plans/ladder'
import { isAddonRefundReason, type AddonRefundReason } from '../plans/ladder-copy'

/** Metadata kind on the one-off invoice for an add-on's first period (admin / reconciliation). */
export const ADDON_FIRST_PERIOD_KIND = 'addon_first_period'
/** Invoice metadata markers (Aria, Oct 4 8:59, self-heal): set once the add-on is on / the charge is refunded. */
export const ADDON_APPLIED_META = 'addon_applied'
export const ADDON_REFUNDED_META = 'addon_refunded'
/** Why it was refunded (AddonRefundReason) and where the money went: shown on the Plans page and emailed. */
export const ADDON_REFUND_REASON_META = 'addon_refund_reason'
export const ADDON_REFUND_CARD_META = 'addon_refund_card_cents'
export const ADDON_REFUND_CREDIT_META = 'addon_refund_credit_cents'

/** Where an add-on charge's money came from: the card paid amount_paid, account credit the rest. */
export function addonRefundSplit(amountPaidCents: number, cents: number): { cardCents: number; creditCents: number } {
  const cardCents = Math.max(0, Math.min(amountPaidCents, cents))
  return { cardCents, creditCents: Math.max(0, cents - cardCents) }
}

/** The refund recorded on an add-on invoice (metadata), or null when it isn't a refunded add-on charge. */
export function addonRefundOf(inv: { metadata?: Record<string, string> | null; total?: number | null; amount_paid?: number | null }): {
  addon: AddonId
  reason: AddonRefundReason
  cardCents: number
  creditCents: number
} | null {
  const m = (inv.metadata ?? {}) as Record<string, string | undefined>
  const addon = addonById(m.addon)
  if (m.freeplug_kind !== ADDON_FIRST_PERIOD_KIND || !m[ADDON_REFUNDED_META] || !addon) return null
  const fallback = addonRefundSplit(inv.amount_paid ?? 0, inv.total ?? 0)
  const num = (v: string | undefined, d: number) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : d)
  return {
    addon: addon.id,
    reason: isAddonRefundReason(m[ADDON_REFUND_REASON_META]) ? (m[ADDON_REFUND_REASON_META] as AddonRefundReason) : 'not_added',
    cardCents: num(m[ADDON_REFUND_CARD_META], fallback.cardCents),
    creditCents: num(m[ADDON_REFUND_CREDIT_META], fallback.creditCents),
  }
}
