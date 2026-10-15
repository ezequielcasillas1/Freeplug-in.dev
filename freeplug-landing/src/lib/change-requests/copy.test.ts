import { describe, expect, it } from 'vitest'
import { customerStatusLines } from './copy'

describe('customerStatusLines', () => {
  it('pending (and any unknown status) reads as received, no detail line', () => {
    expect(customerStatusLines('pending_review', null)).toEqual({ label: "Received, we're working on it", detail: null })
    expect(customerStatusLines('something_new', 'x')).toEqual({ label: "Received, we're working on it", detail: null })
  })
  it('approved shows only "Approved", never the team note', () => {
    expect(customerStatusLines('approved', 'Internal: ship Monday')).toEqual({ label: 'Approved', detail: null })
  })
  it('declined with a note shows "Our note: {note}" (trimmed)', () => {
    expect(customerStatusLines('declined', '  Only hours can change.  ')).toEqual({ label: 'Not approved', detail: 'Our note: Only hours can change.' })
  })
  it('declined with no note, or a blank one, shows the support line', () => {
    for (const note of [null, undefined, '', '   ']) {
      expect(customerStatusLines('declined', note)).toEqual({ label: 'Not approved', detail: 'Questions? Email support@freeplug-in.dev.' })
    }
  })
})
