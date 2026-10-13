/** i18n-es-base: the 24 ladder keys from BASE-QA-phase1 (H-1) go through the catalog (Sable, 10-13 sheet). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_MARK_BIG_CHANGE, ladderCopy } from './ladder-copy'
import enMessages from '../../../messages/en.json'
import esMessages from '../../../messages/es.json'

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
    expect(es().addonRefundSplitLine(0, 500, 35)).toBe('Te devolvimos $4.65 a tu saldo a favor y cancelamos el cargo pequeño de $0.35, así que no lo pagarás.')
    expect(es().addonRefundSplitLine(300, 200)).toBe('Te reembolsamos $3 a tu tarjeta y devolvimos $2 a tu saldo a favor.')
    expect(es().addonRefundSplitLine(0, 200)).toBe('Te devolvimos $2 a tu saldo a favor.')
    expect(es().addonRefundSplitLine(300, 0)).toBe('Te reembolsamos $3 a tu tarjeta.')
    expect(es().addonRefunded('Big change', 300, 0)).toBe(
      'No pudimos activar Big change. Te reembolsamos $3 a tu tarjeta. El reembolso a tu tarjeta puede tardar de 5 a 10 días hábiles en aparecer.'
    )
    expect(es().addonRefunded('Big change', 0, 200)).toBe('No pudimos activar Big change. Te devolvimos $2 a tu saldo a favor.')
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
    expect(es().ADDON_NAMES.small_edit).toBe('+1 small edit')
    expect(es().addonNameList(['small_edit', 'big_change'])).toBe('+1 small edit y Big change')
    expect(es().addonTodayTotal(535)).toBe('$5.35 hoy')
    expect(en().addonTodayTotal(535)).toBe('$5.35 today')
    expect(es().addonChargeNote(500)).toBe('Al activarlo, se cobran $5 hoy por este periodo de facturación y luego $5 cada mes. Primero usamos tu saldo a favor, si tienes. Si lo desactivas, sigue activo hasta que termine el periodo.')
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

describe('Sable 04:22 (freeplug-ladder-es-2026-10-13.md)', () => {
  it('unknown add-on fallback: "Complemento" in es only; named add-ons stay English', () => {
    expect(ladderCopy('en').GENERIC_ADDON_NAME('$15')).toBe('Add-on ($15)')
    expect(ladderCopy('en').GENERIC_ADDON_NAME()).toBe('Add-on')
    expect(ladderCopy('es').GENERIC_ADDON_NAME('$15')).toBe('Complemento ($15)')
    expect(ladderCopy('es').GENERIC_ADDON_LABEL).toBe('Complemento')
    expect(ladderCopy('es').ADDON_NAMES.small_edit).toBe('+1 small edit')
    expect(ladderCopy('es').ADDON_NAMES.big_change).toBe('Big change')
  })
  it('switch busy label', () => {
    expect(ladderCopy('en').CHANGE_PLAN_SWITCHING).toBe('Switching…')
    expect(ladderCopy('es').CHANGE_PLAN_SWITCHING).toBe('Cambiando de plan…')
  })
  it('short charge note is a spare string; the full note is what addonChargeNote shows', () => {
    expect(ladderCopy('es').addonChargeNoteShort(500)).toBe('Se cobran $5 hoy y luego $5 al mes. Primero usamos tu saldo a favor. Si lo desactivas, sigue activo hasta fin de periodo.')
    expect(ladderCopy('es').addonChargeNote(500)).toMatch(/^Al activarlo, se cobran \$5 hoy por este periodo de facturación/)
  })
})

describe('Sable 04:29: charge notes use {total} for today and {price} for the month', () => {
  const NOTE_KEYS = ['chargeNote', 'chargeNoteShort'] as const
  const catalogs = { en: enMessages as unknown as { addons: Record<string, string> }, es: esMessages as unknown as { addons: Record<string, string> } }
  for (const [loc, cat] of Object.entries(catalogs)) {
    for (const key of NOTE_KEYS) {
      it(`${loc} addons.${key}: exactly one {total} and one {price}`, () => {
        const v = cat.addons[key]
        expect(v, key).toBeTypeOf('string')
        expect(v.match(/\{total\}/g)?.length ?? 0).toBe(1)
        expect(v.match(/\{price\}/g)?.length ?? 0).toBe(1)
      })
    }
  }
})
