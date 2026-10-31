import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import en from '../../../../messages/en.json'
import es from '../../../../messages/es.json'
import { IN_PERSON_EMAIL } from './InPersonSection'

describe('InPersonSection', () => {
  it('uses the approved headline and email', () => {
    expect(en.public.landing.inPerson.heading).toBe('Prefer to Meet in Person?')
    expect(IN_PERSON_EMAIL).toBe('discover@freeplug-in.dev')
    expect(es.public.landing.inPerson.heading).toBeTruthy()
  })
  it('never shows an address', () => {
    const all = JSON.stringify([en.public.landing.inPerson, es.public.landing.inPerson]) + readFileSync(__dirname + '/InPersonSection.tsx', 'utf8')
    expect(all).not.toMatch(/\d{2,5}\s+\w+\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Ln|Hwy)\b/i)
    expect(all).not.toMatch(/\b7\d{4}\b/)
  })
})
