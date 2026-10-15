import { describe, expect, it } from 'vitest'
import { formatNoteDate, NOTE_DATE_TIME_ZONE } from './note-date'

describe('formatNoteDate (Lina 10:33): short month + day, the year only when not the current one, America/Chicago', () => {
  const now = new Date('2026-10-04T15:00:00Z')
  it('same year: "Oct 4"', () => {
    expect(NOTE_DATE_TIME_ZONE).toBe('America/Chicago')
    expect(formatNoteDate(new Date('2026-10-04T15:00:00Z'), now)).toBe('Oct 4')
    expect(formatNoteDate(new Date('2026-09-05T15:00:00Z'), now)).toBe('Sep 5')
  })
  it('Central time decides the day: 11:30 PM CT on Oct 3 is Oct 3 (04:30 UTC on Oct 4)', () => {
    expect(formatNoteDate(new Date('2026-10-04T04:30:00Z'), now)).toBe('Oct 3')
    expect(formatNoteDate(new Date('2026-10-04T05:00:00Z'), now)).toBe('Oct 4')
  })
  it('another year: "Dec 30, 2025"; and Dec 31 8 PM CT seen on Jan 1 (CT) carries its year', () => {
    expect(formatNoteDate(new Date('2025-12-30T18:00:00Z'), now)).toBe('Dec 30, 2025')
    expect(formatNoteDate(new Date('2027-01-01T02:00:00Z'), new Date('2027-01-01T18:00:00Z'))).toBe('Dec 31, 2026')
  })
})
