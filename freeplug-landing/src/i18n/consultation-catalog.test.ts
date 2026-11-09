import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import es from '../../messages/es.json'
import pending from '../../messages/pending-sable.json'
import * as COPY from '@/lib/consultation/copy'
import { consultationCopy, consultationTranslator } from '@/lib/consultation/i18n'
import { flattenMessages } from './messages'

type Tree = { [k: string]: string | Tree }
const camel = (k: string) => k.toLowerCase().replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const EN = flattenMessages((en as unknown as { consultation: Tree }).consultation, 'consultation')
const ES = flattenMessages((es as unknown as { consultation: Tree }).consultation, 'consultation')

describe('consultation strings in the i18n catalogs (Oct 22 r2)', () => {
  it('every copy.ts string is in en.json with the same English', () => {
    for (const [k, v] of Object.entries(COPY)) {
      if (typeof v === 'string') expect(EN[`consultation.${camel(k)}`], k).toBe(v)
      else if (v && typeof v === 'object')
        for (const [sub, s] of Object.entries(v as Record<string, string>)) expect(EN[`consultation.${camel(k)}.${sub}`], `${k}.${sub}`).toBe(s)
    }
  })
  it('the template strings render like copy.ts', () => {
    const t = consultationTranslator('en')
    expect(t('liveBookedBody', { hasWhen: 'yes', when: 'Fri 3 PM', method: 'phone' })).toBe(COPY.liveBookedBody('Fri 3 PM', 'phone'))
    expect(t('liveBookedBody', { hasWhen: 'no', when: '', method: 'text' })).toBe(COPY.liveBookedBody(null, 'text'))
    expect(t('bookingRefLine', { value: 'cal.com:abc' })).toBe(COPY.bookingRefLine('cal.com:abc'))
    expect(consultationTranslator('es')('bookingRefLine', { value: 'x' })).toBe('Reserva: x')
    expect(t('emailAgreedTeamSubject', { business: 'Biz' })).toBe(COPY.EMAIL_AGREED_TEAM_SUBJECT('Biz'))
    expect(t('emailCancelRequestTeamSubject', { business: 'Biz' })).toBe(COPY.EMAIL_CANCEL_REQUEST_TEAM_SUBJECT('Biz'))
    expect(t('emailLiveBookedTeamSubject', { business: 'Biz' })).toBe(COPY.EMAIL_LIVE_BOOKED_TEAM_SUBJECT('Biz'))
  })
  it('es.json has every consultation key, all translated by Sable (nothing pending)', () => {
    expect(Object.keys(ES).sort()).toEqual(Object.keys(EN).sort())
    expect(pending.spanishEnglishFallback).toEqual({})
    // English by design (Sable, Oct 22): team-only subjects go to fplgn.dev inboxes only.
    const englishByDesign = ['emailAgreedTeamSubject', 'emailLiveBookedTeamSubject', 'emailCancelRequestTeamSubject'].map((k) => `consultation.${k}`)
    for (const k of Object.keys(EN)) {
      if (englishByDesign.includes(k)) expect(ES[k], k).toBe(EN[k])
      else if (k !== 'consultation.liveMethodLabels.facetime') expect(ES[k], k).not.toBe(EN[k])
    }
  })
  it("Spanish translator serves Sable's Spanish; STOP stays English", () => {
    const t = consultationTranslator('es')
    expect(t('consultCardHeading')).toBe('Siguiente: tu consulta')
    expect(t('looksGoodLabel')).toBe('Se ve bien')
    expect(t('textConsentText')).toContain('Responde STOP')
    expect(t('liveBookedBody', { hasWhen: 'yes', when: 'vie 3 PM', method: 'Llamada' })).toBe(
      'Nos vemos vie 3 PM por Llamada. Después de la sesión te mandamos un resumen por escrito para que lo revises.'
    )
  })
  it('consultationCopy(locale) mirrors copy.ts in English and serves Spanish, team subjects English', () => {
    const enCopy = consultationCopy('en')
    for (const [k, v] of Object.entries(COPY)) if (typeof v === 'string') expect((enCopy as Record<string, unknown>)[k], k).toBe(v)
    const es = consultationCopy('es')
    expect(es.REQUEST_CANCEL_BUTTON).toBe('Pedir cancelación')
    expect(es.LIVE_METHOD_LABELS.text).toBe('Mensajes de texto')
    expect(es.liveBookedBody(null, 'FaceTime')).toMatch(/^Nos vemos pronto por FaceTime\./)
    expect(es.EMAIL_AGREED_TEAM_SUBJECT('Biz')).toBe('Consultation agreed: Biz')
    expect(enCopy.liveBookedBody('Fri', 'phone')).toBe(COPY.liveBookedBody('Fri', 'phone'))
  })
  it('quoted button labels match the buttons (Sable rule)', () => {
    const es = consultationCopy('es')
    expect(es.LOOKS_GOOD_NOTE).toContain(es.LOOKS_GOOD_LABEL)
    expect(es.CONSULTATION_GATE_MESSAGE).toContain(es.LOOKS_GOOD_LABEL)
    expect(es.CLOSE_BUILDING_REFUSED).toContain(es.REQUEST_CANCEL_BUTTON)
  })
})
