import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import es from '../../messages/es.json'
import pending from '../../messages/pending-sable.json'
import * as COPY from '@/lib/consultation/copy'
import { consultationTranslator } from '@/lib/consultation/i18n'
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
    expect(t('emailAgreedTeamSubject', { business: 'Biz' })).toBe(COPY.EMAIL_AGREED_TEAM_SUBJECT('Biz'))
    expect(t('emailCancelRequestTeamSubject', { business: 'Biz' })).toBe(COPY.EMAIL_CANCEL_REQUEST_TEAM_SUBJECT('Biz'))
    expect(t('emailLiveBookedTeamSubject', { business: 'Biz' })).toBe(COPY.EMAIL_LIVE_BOOKED_TEAM_SUBJECT('Biz'))
  })
  it('es.json has every consultation key (Spanish stays servable), each tracked as TODO for Sable', () => {
    expect(Object.keys(ES).sort()).toEqual(Object.keys(EN).sort())
    const todo = pending.spanishEnglishFallback as Record<string, string>
    expect(Object.keys(todo).sort()).toEqual(Object.keys(EN).sort())
    for (const [k, why] of Object.entries(todo)) expect(why, k).toMatch(/^TODO Sable/)
  })
  it('Spanish translator resolves the keys (English fallback until Sable translates)', () => {
    expect(consultationTranslator('es')('consultCardHeading')).toBe(EN['consultation.consultCardHeading'])
  })
})
