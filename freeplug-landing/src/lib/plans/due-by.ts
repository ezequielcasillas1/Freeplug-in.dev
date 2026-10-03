import { BUSINESS_TIME_ZONE, SMALL_EDIT_DUE_HOUR_CT } from './ladder'

type Parts = { y: number; m: number; d: number; h: number; min: number; wd: number }

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function zoned(date: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  })
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, wd: WEEKDAYS[p.weekday] }
}

/** UTC instant of a wall-clock time in tz (DST-safe for whole hours outside the switch hour). */
function wallToUtc(y: number, m: number, d: number, h: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h)
  let t = guess
  for (let i = 0; i < 2; i++) {
    const p = zoned(new Date(t), tz)
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min)
    t = t + (guess - asUtc)
  }
  return new Date(t)
}

/**
 * Due time for a small edit asked for at `now`: the end (SMALL_EDIT_DUE_HOUR_CT, Central) of the
 * next business day (Mon-Fri) after the day of the request. Friday and weekend requests are due
 * Monday. Holidays are not handled yet.
 */
export function nextBusinessDayDue(now: Date, tz = BUSINESS_TIME_ZONE, hour = SMALL_EDIT_DUE_HOUR_CT): Date {
  const today = zoned(now, tz)
  // Walk calendar days in UTC-noon steps (avoids DST edge cases), starting tomorrow.
  let cursor = Date.UTC(today.y, today.m - 1, today.d, 12)
  for (let i = 0; i < 7; i++) {
    cursor += 24 * 3600 * 1000
    const c = new Date(cursor)
    const wd = c.getUTCDay()
    if (wd >= 1 && wd <= 5) return wallToUtc(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate(), hour, tz)
  }
  throw new Error('unreachable')
}
