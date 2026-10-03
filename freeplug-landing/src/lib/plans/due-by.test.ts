import { describe, expect, it } from 'vitest'
import { nextBusinessDayDue } from './due-by'
import { BUSINESS_HOLIDAYS, EXTRA_CLOSED_DATES, holidaysForYear, isBusinessDate, type HolidayRule } from './ladder'

const ct = (d: Date) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(d)

describe('business holidays (config in ladder.ts, computed per year)', () => {
  it('lists the six holidays Aria named, in config order', () => {
    expect(BUSINESS_HOLIDAYS.map((h) => h.name)).toEqual([
      "New Year's Day",
      'Memorial Day',
      'Independence Day',
      'Labor Day',
      'Thanksgiving',
      'Christmas Day',
    ])
    expect(EXTRA_CLOSED_DATES).toEqual([])
  })

  it.each([
    [2026, ['2026-01-01', '2026-05-25', '2026-07-04', '2026-09-07', '2026-11-26', '2026-12-25']],
    [2027, ['2027-01-01', '2027-05-31', '2027-07-04', '2027-09-06', '2027-11-25', '2027-12-25']],
    [2028, ['2028-01-01', '2028-05-29', '2028-07-04', '2028-09-04', '2028-11-23', '2028-12-25']],
  ])('%i dates', (year, dates) => {
    expect(holidaysForYear(year).map((h) => h.date)).toEqual(dates)
  })

  it('a weekday holiday is not a business day; weekends never are; a normal weekday is', () => {
    expect(isBusinessDate(2026, 11, 26)).toBe(false) // Thanksgiving (Thu)
    expect(isBusinessDate(2026, 12, 25)).toBe(false) // Christmas (Fri)
    expect(isBusinessDate(2026, 11, 27)).toBe(true) // day after Thanksgiving: open unless added
    expect(isBusinessDate(2026, 10, 10)).toBe(false) // Saturday
    expect(isBusinessDate(2026, 10, 6)).toBe(true)
  })

  it('is easy to edit: custom rules and one-off closed dates', () => {
    const rules: HolidayRule[] = [{ name: 'MLK Day', month: 1, weekday: 1, nth: 3 }]
    expect(holidaysForYear(2026, rules)).toEqual([{ date: '2026-01-19', name: 'MLK Day' }])
    expect(isBusinessDate(2026, 1, 19, rules)).toBe(false)
    expect(isBusinessDate(2026, 11, 27, BUSINESS_HOLIDAYS, ['2026-11-27'])).toBe(false)
  })
})

describe('small-edit due time: next business day, 5 PM Central, skipping weekends and holidays', () => {
  it.each([
    // holidays
    ['2026-11-25T16:00:00Z', '11/27/2026, 17 CST', 'Wed before Thanksgiving -> Fri'],
    ['2026-11-26T16:00:00Z', '11/27/2026, 17 CST', 'on Thanksgiving -> Fri'],
    ['2026-12-24T16:00:00Z', '12/28/2026, 17 CST', 'Christmas Eve (Thu) -> Christmas Fri skipped -> Mon'],
    ['2026-12-31T16:00:00Z', '1/4/2027, 17 CST', "New Year's Eve (Thu) -> Jan 1 Fri skipped -> Mon"],
    ['2026-05-22T15:00:00Z', '5/26/2026, 17 CDT', 'Fri before Memorial Day -> Tue'],
    ['2026-09-04T15:00:00Z', '9/8/2026, 17 CDT', 'Fri before Labor Day -> Tue'],
    ['2026-07-03T15:00:00Z', '7/6/2026, 17 CDT', 'July 4 on a Saturday is not moved -> Mon'],
    ['2027-07-02T15:00:00Z', '7/5/2027, 17 CDT', 'July 4 2027 on a Sunday is not moved -> Mon'],
    // spring DST (Sun Mar 8 2026, 2 AM CST -> 3 AM CDT)
    ['2026-03-06T16:00:00Z', '3/9/2026, 17 CDT', 'Fri 10 AM CST -> Mon 5 PM CDT'],
    ['2026-03-08T07:59:00Z', '3/9/2026, 17 CDT', 'Sun 1:59 AM CST, just before the jump'],
    ['2026-03-08T08:30:00Z', '3/9/2026, 17 CDT', 'Sun 3:30 AM CDT, just after the jump'],
    ['2026-03-09T04:59:00Z', '3/9/2026, 17 CDT', 'Sun 11:59 PM CDT -> Mon'],
    ['2026-03-09T05:00:00Z', '3/10/2026, 17 CDT', 'Mon 12:00 AM CDT -> Tue'],
    // fall DST (Sun Nov 1 2026, 2 AM CDT -> 1 AM CST)
    ['2026-10-30T20:00:00Z', '11/2/2026, 17 CST', 'Fri 3 PM CDT -> Mon 5 PM CST'],
    ['2026-11-01T06:30:00Z', '11/2/2026, 17 CST', 'Sun 1:30 AM CDT (first pass)'],
    ['2026-11-01T07:30:00Z', '11/2/2026, 17 CST', 'Sun 1:30 AM CST (repeated hour)'],
    ['2026-11-02T05:59:00Z', '11/2/2026, 17 CST', 'Sun 11:59 PM CST -> Mon'],
    ['2026-11-02T06:00:00Z', '11/3/2026, 17 CST', 'Mon 12:00 AM CST -> Tue'],
  ])('%s -> %s (%s)', (iso, expected) => {
    const due = nextBusinessDayDue(new Date(iso))
    expect(ct(due).replace(/^\w{3}, /, '')).toBe(expected)
    expect(due.getUTCMinutes()).toBe(0)
  })

  it('UTC offsets: 5 PM CDT = 22:00Z, 5 PM CST = 23:00Z, on both sides of each switch', () => {
    expect(nextBusinessDayDue(new Date('2026-03-06T16:00:00Z')).toISOString()).toBe('2026-03-09T22:00:00.000Z')
    expect(nextBusinessDayDue(new Date('2026-03-05T16:00:00Z')).toISOString()).toBe('2026-03-06T23:00:00.000Z')
    expect(nextBusinessDayDue(new Date('2026-10-29T16:00:00Z')).toISOString()).toBe('2026-10-30T22:00:00.000Z')
    expect(nextBusinessDayDue(new Date('2026-10-30T20:00:00Z')).toISOString()).toBe('2026-11-02T23:00:00.000Z')
  })

  it('fails loudly instead of looping if the config closes every day', () => {
    expect(() => nextBusinessDayDue(new Date('2026-10-05T15:00:00Z'), 'America/Chicago', 17, () => false)).toThrow(/No business day/)
  })
})
