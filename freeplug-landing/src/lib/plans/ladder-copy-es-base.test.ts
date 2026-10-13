/** i18n-es-base: the 24 ladder keys from BASE-QA-phase1 (H-1) go through the catalog (Sable, 10-13 sheet). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_MARK_BIG_CHANGE, ladderCopy } from './ladder-copy'

beforeEach(() => vi.stubEnv('FREEPLUG_I18N_ES_ALLOW_PENDING', '1'))
afterEach(() => vi.unstubAllEnvs())

const NBSP_DATE = '9\u00A0de\u00A0octubre\u00A0de\u00A02026'

describe('ladder keys added after the i18n snapshot', () => {
  const es = () => ladderCopy('es')
  const en = () => ladderCopy('en')

  it('Spanish values', () => {
    expect(es().RESUME_REMOVAL_OWED_STATUS('Big change')).toBe('Tu plan está activo de nuevo. Todavía estamos desactivando Big change. Si se cobra antes de terminar, te lo reembolsamos.')
    expect(es().DOWNLOAD_INVOICE_PDF).toBe('PDF')
    expect(es().renewalCarriedLine(35)).toBe('Incluye $0.35 pendiente de tu último cambio.')
    expect(es().renewalLineText(4035, NBSP_DATE)).toBe(`Tu próximo cobro será de $40.35 el ${NBSP_DATE}.`)
    expect(es().addonTipDropQuestion(4, 'Big change')).toBe('Tu propina bajará a $4. ¿Activar Big change?')
    expect(es().addonAddedToNextBill(35)).toBe('Se agregarán $0.35 a tu próximo cobro.')
    expect(es().addonCarriedBreakdown(500, 35)).toBe('$5.00 + $0.35 pendiente de tu último cambio')
    expect(es().ADDON_PRICE_UNCONFIRMED).toBe('No pudimos confirmar este precio. Inténtalo de nuevo o escribe a support@freeplug-in.dev y te ayudamos.')
    expect(es().addonRefundSplitLine(0, 500, 35)).toBe('Devolvimos $4.65 al crédito de tu cuenta y cancelamos el cargo pequeño de $0.35, así que no lo pagarás.')
    expect(es().addonRefundSplitLine(300, 200)).toBe('Te reembolsamos $3 a tu tarjeta y devolvimos $2 al crédito de tu cuenta.')
    expect(es().addonRefundSplitLine(0, 200)).toBe('Devolvimos $2 al crédito de tu cuenta.')
    expect(es().addonRefundSplitLine(300, 0)).toBe('Te reembolsamos $3 a tu tarjeta.')
    expect(es().addonRefunded('Big change', 300, 0)).toBe(
      'No pudimos activar Big change. Te reembolsamos $3 a tu tarjeta. El reembolso a tu tarjeta puede tardar de 5 a 10 días hábiles en aparecer.'
    )
    expect(es().addonRefunded('Big change', 0, 200)).toBe('No pudimos activar Big change. Devolvimos $2 al crédito de tu cuenta.')
    expect(es().ADDON_REFUND_REASONS.switch_pending('X')).toMatch(/^No pudimos activar X porque ya había un cambio de plan programado\./)
    expect(es().ADDON_REFUND_REASONS.removal_pending('X')).toMatch(/^No pudimos activar X porque otro complemento/)
    expect(es().ADDON_REFUND_REASONS.period_ended('X')).toMatch(/periodo de facturación que pagaste/)
    expect(es().ADDON_REFUND_REASONS.tip_unconfirmed('X')).toMatch(/habría bajado tu propina/)
    expect(es().ADDON_REFUND_REASONS.plan_ended('X')).toMatch(/plan de hospedaje web terminó/)
    expect(es().ADDON_REFUND_REASONS.not_added('X')).toBe('No pudimos activar X por un problema al agregarlo a tu plan.')
    expect(es().ADDON_REFUND_REASONS.turned_off('X')).toBe('Desactivaste X, pero aun así se cobró en este periodo.')
    expect(es().addonRefundEmailSubject('X')).toBe('No pudimos activar X')
    expect(es().addonTurnedOffRefundEmailSubject('X')).toBe('Te reembolsamos el cobro de X.')
    expect(es().ADDON_REFUND_EMAIL_HELP).toBe('¿Preguntas? Escribe a support@freeplug-in.dev.')
  })

  it('the 3 same-as-English checks and the admin string', () => {
    expect(es().INVOICE_PLAN_PART('$35')).toBe('Plan $35')
    expect(es().GRANDFATHERED_HOSTING_SHORT).toBe('Hospedaje')
    expect(es().ADDON_NAMES.small_edit).toBe('+1 cambio pequeño')
    expect(es().addonNameList(['small_edit', 'big_change'])).toBe('+1 cambio pequeño y Big change')
    expect(ADMIN_MARK_BIG_CHANGE).toBe('Mark as big change')
  })

  it('English is unchanged from ladder-fix (word for word)', () => {
    expect(en().RESUME_REMOVAL_OWED_STATUS('Big change')).toBe("Your plan is back on. We're still turning off Big change. If it's charged before that's done, we'll refund it.")
    expect(en().renewalCarriedLine(35)).toBe('Includes $0.35 left from your last change.')
    expect(en().addonTipDropQuestion(4, 'Big change')).toBe('Your tip goes down to $4. Turn on Big change?')
    expect(en().addonRefunded('Big change', 300, 200)).toBe(
      "We couldn't turn on Big change. We refunded $3 to your card and added $2 back to your account credit. The card refund can take 5–10 business days to show up."
    )
    expect(en().addonNameList(['small_edit', 'big_change'])).toBe('+1 small edit and Big change')
    expect(en().GRANDFATHERED_HOSTING_SHORT).toBe('Hosting')
    expect(en().ADDON_REFUND_EMAIL_HELP).toBe('Questions? Email support@freeplug-in.dev.')
  })
})
