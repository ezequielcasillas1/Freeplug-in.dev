// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { initialFieldStates, phoneInvalid, removeService, toSubmission, undoRemoveService, type FieldState, type ServiceState } from './details-state'
import type { PrefillMap } from './schemas'

describe('service Remove / Undo (Vera QA #7)', () => {
  const s = (choice: ServiceState['choice']): ServiceState => ({ name: 'Lawn mowing', choice, added: false })
  it('Undo restores Keep or unanswered, whichever it was', () => {
    expect(undoRemoveService(removeService(s('keep'))).choice).toBe('keep')
    expect(undoRemoveService(removeService(s(null))).choice).toBeNull()
    // Removing twice doesn't forget the earlier answer.
    expect(undoRemoveService(removeService(removeService(s('keep')))).choice).toBe('keep')
  })

  it('unanswered services are left out of the submission (Apply keeps them; Vera QA #2)', () => {
    const out = toSubmission([], [s(null), { name: 'Weeding', choice: 'remove', added: false }, { name: 'New one', choice: 'keep', added: true }])
    expect(out.services).toEqual([
      { name: 'Weeding', keep: false },
      { name: 'New one', keep: true },
    ])
  })
})

describe('only answered fields are sent or shown as confirmed (Vera r2 bug 2)', () => {
  const prefill = {
    hours: { value: 'Sun–Sat 8:00 am – 6:00 pm', source: 'Thumbtack profile' },
    service_area: { value: 'Austin, TX', source: 'Thumbtack profile' },
    phone: { value: '5125550100', source: 'Thumbtack profile' },
  } as unknown as PrefillMap
  const f = (key: FieldState['key'], value: string, mode: FieldState['mode']): FieldState => ({ key, value, source: null, mode })

  it('untouched pre-fills and empty fields are left out; confirmed and edited ones are sent', () => {
    const out = toSubmission(
      [f('hours', 'Sun–Sat 8:00 am – 6:00 pm', 'prefilled'), f('service_area', 'Austin, TX', 'confirmed'), f('address', '', 'editing'), f('quote_email', 'a@b.co', 'blank'), f('phone', '(512) 555-0142', 'editing')],
      []
    )
    expect(out.fields).toEqual({ service_area: 'Austin, TX', quote_email: 'a@b.co', phone: '512-555-0142' })
  })

  it('claim step 2 starts from what was sent: same as pre-fill = confirmed, different = edit, missing = pre-filled', () => {
    const states = initialFieldStates(prefill, { phone: '512-555-0100', service_area: 'Round Rock' })
    const by = Object.fromEntries(states.map((s) => [s.key, s]))
    expect(by.phone).toMatchObject({ mode: 'confirmed', value: '512-555-0100', source: 'Thumbtack profile' })
    expect(by.service_area).toMatchObject({ mode: 'editing', value: 'Round Rock' })
    expect(by.hours).toMatchObject({ mode: 'prefilled', value: 'Sun–Sat 8:00 am – 6:00 pm' })
    expect(by.quote_email).toMatchObject({ mode: 'blank', value: '' })
  })

  it('with nothing sent, nothing is confirmed', () => {
    expect(initialFieldStates(prefill).filter((s) => s.mode === 'confirmed')).toEqual([])
  })

  it('phoneInvalid: empty or a pre-fill is fine, 7 digits or text is not', () => {
    expect(phoneInvalid([f('phone', '', 'blank')])).toBe(false)
    expect(phoneInvalid([f('phone', 'junk', 'prefilled')])).toBe(false)
    expect(phoneInvalid([f('phone', '555-0142', 'editing')])).toBe(true)
    expect(phoneInvalid([f('phone', 'call 5125550142', 'editing')])).toBe(true)
    expect(phoneInvalid([f('phone', '+1 (512) 555-0142', 'editing')])).toBe(false)
  })
})
