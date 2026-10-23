/**
 * Cal.com embed (card: "embedded scheduler, Cal.com; no custom calendar"). Set
 * NEXT_PUBLIC_CALCOM_LINK to the event path, e.g. "freeplug/consultation". Unset = test mode: the
 * booking page shows a plain time picker that simulates a booking (local preview only).
 */
export function calcomLink(): string | null {
  const raw = process.env.NEXT_PUBLIC_CALCOM_LINK?.trim()
  if (!raw) return null
  const path = raw.replace(/^https?:\/\/(app\.)?cal\.com\//, '').replace(/^\/+|\/+$/g, '')
  return /^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/i.test(path) ? path : null
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
