import { describe, expect, it } from 'vitest'
import EN from '../../../messages/en.json'
import ES from '../../../messages/es.json'
import { entitlementsFor, NO_PLAN_ENTITLEMENTS, PLAN_STEP_IDS } from './ladder'
import { hasWeekendReplies, responseDaysKey } from './response-days'

const copy = (cat: typeof EN, ent: Parameters<typeof hasWeekendReplies>[0]) =>
  (cat.common.support as Record<string, string>)[responseDaysKey(hasWeekendReplies(ent))]

describe('response days: plan -> SupportCard copy (Cheke Oct 19)', () => {
  it('Starter ($35) and no plan: business days, Monday to Friday', () => {
    for (const ent of [entitlementsFor({ stepId: 'starter' }), NO_PLAN_ENTITLEMENTS, null]) {
      expect(hasWeekendReplies(ent)).toBe(false)
      expect(copy(EN, ent)).toBe('We respond on business days, Monday to Friday (Central time).')
      expect(copy(ES, ent)).toBe('Respondemos en días hábiles, de lunes a viernes (hora del Centro).')
    }
  })
  it('Priority ($55) and every step above it: business days and weekends', () => {
    for (const id of PLAN_STEP_IDS.filter((s) => s !== 'starter')) {
      const ent = entitlementsFor({ stepId: id })
      expect(hasWeekendReplies(ent)).toBe(true)
      expect(copy(EN, ent)).toBe('We respond on business days and weekends (Central time).')
      expect(copy(ES, ent)).toBe('Respondemos en días hábiles y fines de semana (hora del Centro).')
    }
  })
  it('grandfathered plans follow their bought plan rank, never a tip', () => {
    expect(hasWeekendReplies(entitlementsFor({ legacy: { hostingCents: 3500, addonTier: null } }))).toBe(false)
    expect(hasWeekendReplies(entitlementsFor({ legacy: { hostingCents: 5500, addonTier: null } }))).toBe(true)
  })
  it('card title in both catalogs', () => {
    expect(EN.common.support.respondLabel).toBe('When we respond')
    expect(ES.common.support.respondLabel).toBe('Cuándo respondemos')
  })
})
