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
/**
 * L-1 (Aria, Oct 4 9:57): on a RENEWAL invoice, the add-ons the customer had turned off that were still
 * billed and were refunded by the invoice.paid self-heal (comma-separated ids). Set with the refund marks.
 */
export const ADDON_TURNED_OFF_META = 'addon_turned_off_refunded'
/** When the refund was made (unix seconds), for the note's date line (Lina 10:33). Older invoices lack it. */
export const ADDON_REFUNDED_AT_META = 'addon_refunded_at'

/** Where an add-on charge's money came from: the card paid amount_paid, account credit the rest. */
export function addonRefundSplit(amountPaidCents: number, cents: number): { cardCents: number; creditCents: number } {
  const cardCents = Math.max(0, Math.min(amountPaidCents, cents))
  return { cardCents, creditCents: Math.max(0, cents - cardCents) }
}

/**
 * The refund recorded on an invoice (metadata), or null when it isn't a refunded add-on charge:
 *   first_period  the add-on's first-period charge (freeplug_kind addon_first_period), refunded by the self-heal;
 *   turned_off    a renewal that still billed add-ons the customer turned off (L-1), their lines refunded.
 * `addon` is the first add-on; `addons` all of them (a renewal can carry both).
 */
export function addonRefundOf(inv: { metadata?: Record<string, string> | null; total?: number | null; amount_paid?: number | null }): {
  kind: 'first_period' | 'turned_off'
  addon: AddonId
  addons: AddonId[]
  reason: AddonRefundReason
  cardCents: number
  creditCents: number
  /** ISO time of the refund (ADDON_REFUNDED_AT_META), only when recorded. */
  refundedAt?: string
} | null {
  const m = (inv.metadata ?? {}) as Record<string, string | undefined>
  if (!m[ADDON_REFUNDED_META]) return null
  const num = (v: string | undefined, d: number) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : d)
  const at = num(m[ADDON_REFUNDED_AT_META], 0)
  const refundedAt = at > 0 ? { refundedAt: new Date(at * 1000).toISOString() } : {}
  const turnedOff = (m[ADDON_TURNED_OFF_META] ?? '')
    .split(',')
    .map((id) => addonById(id))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => a.id)
  if (turnedOff.length > 0) {
    return {
      kind: 'turned_off',
      addon: turnedOff[0],
      addons: turnedOff,
      reason: 'turned_off',
      cardCents: num(m[ADDON_REFUND_CARD_META], 0),
      creditCents: num(m[ADDON_REFUND_CREDIT_META], 0),
      ...refundedAt,
    }
  }
  const addon = addonById(m.addon)
  if (m.freeplug_kind !== ADDON_FIRST_PERIOD_KIND || !addon) return null
  const fallback = addonRefundSplit(inv.amount_paid ?? 0, inv.total ?? 0)
  return {
    kind: 'first_period',
    addon: addon.id,
    addons: [addon.id],
    reason: isAddonRefundReason(m[ADDON_REFUND_REASON_META]) ? (m[ADDON_REFUND_REASON_META] as AddonRefundReason) : 'not_added',
    cardCents: num(m[ADDON_REFUND_CARD_META], fallback.cardCents),
    creditCents: num(m[ADDON_REFUND_CREDIT_META], fallback.creditCents),
    ...refundedAt,
  }
}
