import { MERCH_SHOP_CUSTOM_DAILY_CAP } from './flags-custom'

const CHICAGO_TZ = 'America/Chicago'

/** Start of calendar day in America/Chicago, as UTC Date. */
export function chicagoDayBoundsUtc(now = new Date()): { dayKey: string; start: Date; end: Date } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHICAGO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const dayKey = fmt.format(now)
  const start = chicagoLocalMidnightToUtc(dayKey)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { dayKey, start, end }
}

function chicagoLocalMidnightToUtc(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map((x) => parseInt(x, 10))
  const padded = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const anchor = Date.UTC(y, m - 1, d, 12, 0, 0, 0)
  for (let offsetHours = -30; offsetHours <= 30; offsetHours++) {
    const candidate = new Date(anchor + offsetHours * 60 * 60 * 1000)
    const dk = new Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      candidate
    )
    const hm = new Intl.DateTimeFormat('en-US', {
      timeZone: CHICAGO_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(candidate)
    if (dk === padded && hm === '00:00') return candidate
  }
  return new Date(anchor - 6 * 60 * 60 * 1000)
}

export function customOrdersCapReached(customPaidToday: number, cap = MERCH_SHOP_CUSTOM_DAILY_CAP): boolean {
  return customPaidToday >= cap
}
