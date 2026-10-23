/** Cheke's Cal.com booking page (Oct 23, 2026). Change here, or override with NEXT_PUBLIC_CALCOM_LINK. */
export const DEFAULT_CALCOM_LINK = 'https://cal.com/fplgn.dev'

/**
 * Cal.com embed (card: "embedded scheduler, Cal.com; no custom calendar"). NEXT_PUBLIC_CALCOM_LINK
 * may be a cal.com path or URL; unset or empty falls back to DEFAULT_CALCOM_LINK. Set it to "off"
 * for test mode: the booking page shows a plain time picker that simulates a booking (local only).
 */
export function calcomLink(): string | null {
  const env = process.env.NEXT_PUBLIC_CALCOM_LINK?.trim()
  if (env && /^(off|none|test)$/i.test(env)) return null
  const raw = env || DEFAULT_CALCOM_LINK
  const path = raw.replace(/^https?:\/\/(app\.)?cal\.com\//, '').replace(/^\/+|\/+$/g, '')
  return /^[a-z0-9_.-]+(\/[a-z0-9_.-]+)*$/i.test(path) && !/(^|\/)\.\.?(\/|$)/.test(path) ? path : null
}

/** Live-session lengths offered on the consultation choice page (cal.com/fplgn.dev/15min, /30min). */
export const CALCOM_SESSION_LENGTHS = [15, 30] as const
export type CalcomSessionLength = (typeof CALCOM_SESSION_LENGTHS)[number]

export function parseSessionLength(v: unknown): CalcomSessionLength | null {
  const n = Number(v)
  return (CALCOM_SESSION_LENGTHS as readonly number[]).includes(n) ? (n as CalcomSessionLength) : null
}

/** Event-type link for a session length: "fplgn.dev" + 15 -> "fplgn.dev/15min". Null link stays null (test mode). */
export function calcomEventLink(link: string | null, minutes: CalcomSessionLength | null): string | null {
  if (!link || !minutes || link.split('/').length > 1) return link
  return `${link}/${minutes}min`
}

/** Live page URL that keeps the chosen session length (reschedule / after booking). */
export function liveSessionHref(q: { edit?: boolean; booked?: boolean; length?: CalcomSessionLength | null }): string {
  const p = new URLSearchParams()
  if (q.edit) p.set('edit', '1')
  if (q.booked) p.set('booked', '1')
  if (q.length) p.set('length', String(q.length))
  const s = p.toString()
  return '/dashboard/consultation/live' + (s ? `?${s}` : '')
}

/** The plain booking page URL (opened in a new tab). */
export function calcomPageUrl(link: string): string {
  return new URL(`https://cal.com/${link}`).toString()
}

/** The iframe URL for the embed, prefilled with the client's email and the request reference. */
export function calcomEmbedUrl(link: string, p: { email?: string; method?: string; ref?: string }): string {
  const u = new URL(`https://cal.com/${link}`)
  u.searchParams.set('embed', 'true')
  if (p.email) u.searchParams.set('email', p.email)
  if (p.method) u.searchParams.set('metadata[method]', p.method)
  if (p.ref) u.searchParams.set('metadata[request]', p.ref)
  return u.toString()
}

/**
 * Reads a Cal.com embed "bookingSuccessful" postMessage. Returns the booking uid and start time
 * when present; anything else (other origins, other events) returns null.
 */
export function parseCalcomMessage(origin: string, data: unknown): { uid: string | null; startTime: string | null } | null {
  if (!/^https:\/\/(app\.)?cal\.com$/.test(origin)) return null
  if (!data || typeof data !== 'object') return null
  const d = data as { type?: unknown; data?: Record<string, unknown> }
  if (typeof d.type !== 'string' || !/bookingSuccessful/.test(d.type)) return null
  const inner = (d.data ?? {}) as Record<string, unknown>
  const booking = (inner.booking ?? inner) as Record<string, unknown>
  const uid = typeof booking.uid === 'string' ? booking.uid : null
  const startTime = typeof booking.startTime === 'string' ? booking.startTime : typeof inner.date === 'string' ? (inner.date as string) : null
  return { uid, startTime }
}
