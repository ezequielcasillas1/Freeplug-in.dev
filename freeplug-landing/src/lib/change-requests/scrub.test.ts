import { describe, expect, it } from 'vitest'
import { SCRUB_TOKEN, scrubForWebhook } from './scrub'

describe('scrubForWebhook', () => {
  it.each([
    ['Email me at maria.lopez+site@gmail.com please', 'Email me at [removed] please'],
    ['Phone (512) 555-0199 on the contact page', 'Phone [removed] on the contact page'],
    ['Change it to 512-555-0199', 'Change it to [removed]'],
    ['Change it to 512.555.0199.', 'Change it to [removed].'],
    ['Call +1 737 392 5612 now', 'Call [removed] now'],
    ['Mexico office +52 55 1234 5678', 'Mexico office [removed]'],
    ['Old number 5550199123', 'Old number [removed]'],
    ['Local line 555-0199', 'Local line [removed]'],
    ['card 4242 4242 4242 4242 exp', 'card [removed] exp'],
    ['card 4242-4242-4242-4242', 'card [removed]'],
    ['amex 378282246310005', 'amex [removed]'],
    ['19 digits 6011000990139424123', '19 digits [removed]'],
  ])('%s', (input, expected) => {
    expect(scrubForWebhook(input)).toBe(expected)
  })

  it.each([
    'Open Mon-Fri 8 am - 6 pm',
    'Prices start at $50 and go to $100',
    'Suite 100, Austin TX 78701',
    'Since 2026-10-04 we close at 5',
    'Change "Est. 1998" to "Est. 1999"',
    'Hours 9:00-17:00',
    'Route 66 Diner',
  ])('leaves ordinary text alone: %s', (input) => {
    expect(scrubForWebhook(input)).toBe(input)
  })

  it('removes several in one description and never leaves digits of a card behind', () => {
    const out = scrubForWebhook('Text 512-555-0199 or a@b.co, card 4111111111111111.')
    expect(out).toBe(`Text ${SCRUB_TOKEN} or ${SCRUB_TOKEN}, card ${SCRUB_TOKEN}.`)
    expect(out).not.toMatch(/\d{4}/)
  })
})
