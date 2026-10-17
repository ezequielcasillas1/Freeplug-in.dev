import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_CONTACT_TO, contactRecipient, validateContact } from './contact'

const good = { name: 'Ana', email: 'ana@example.com', message: 'Hello, I need a website.' }

describe('validateContact', () => {
  it('accepts a valid submission and trims', () => {
    expect(validateContact({ ...good, name: '  Ana ' })).toEqual({ ok: true, value: good })
  })
  it('flags the honeypot', () => {
    expect(validateContact({ ...good, website: 'spam.com' })).toEqual({ ok: 'honeypot' })
  })
  it('rejects bad fields', () => {
    expect(validateContact({ ...good, name: '' }).ok).toBe(false)
    expect(validateContact({ ...good, name: 'a'.repeat(101) }).ok).toBe(false)
    expect(validateContact({ ...good, email: 'nope' }).ok).toBe(false)
    expect(validateContact({ ...good, email: 'a@b.com\nbcc:x@y.com' }).ok).toBe(false)
    expect(validateContact({ ...good, message: 'short' }).ok).toBe(false)
    expect(validateContact({ ...good, message: 'a'.repeat(5001) }).ok).toBe(false)
    expect(validateContact(null).ok).toBe(false)
  })
})

describe('contactRecipient', () => {
  afterEach(() => { delete process.env.CONTACT_FORM_TO })
  it('defaults to iqc', () => expect(contactRecipient()).toBe(DEFAULT_CONTACT_TO))
  it('uses CONTACT_FORM_TO', () => {
    process.env.CONTACT_FORM_TO = 'x@freeplug-in.dev'
    expect(contactRecipient()).toBe('x@freeplug-in.dev')
  })
})
