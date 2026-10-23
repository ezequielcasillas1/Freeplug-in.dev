import * as COPY from './copy'
import type { Translate } from '@/i18n/translate'

export type ConsultationCopy = typeof COPY
const camel = (k: string) => k.toLowerCase().replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/**
 * The consultation copy (same shape as ./copy.ts) in one locale, built from a translator over
 * consultation.*. Screens and customer-facing action errors use this so Spanish users see Spanish;
 * copy.ts stays the English source the catalog sync test pins.
 */
export function buildConsultationCopy(t: Translate): ConsultationCopy {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(COPY)) {
    if (typeof v === 'string') out[k] = t(camel(k))
    else if (v && typeof v === 'object')
      out[k] = Object.fromEntries(Object.keys(v).map((sub) => [sub, t(`${camel(k)}.${sub}`)]))
  }
  out.liveBookedBody = (when: string | null, method: string) =>
    t('liveBookedBody', { hasWhen: when ? 'yes' : 'no', when: when ?? '', method })
  out.bookingRefLine = (value: string) => t('bookingRefLine', { value })
  // Team-only subjects stay English by design (Sable, Oct 22): fplgn.dev inboxes only.
  out.EMAIL_AGREED_TEAM_SUBJECT = COPY.EMAIL_AGREED_TEAM_SUBJECT
  out.EMAIL_LIVE_BOOKED_TEAM_SUBJECT = COPY.EMAIL_LIVE_BOOKED_TEAM_SUBJECT
  out.EMAIL_CANCEL_REQUEST_TEAM_SUBJECT = COPY.EMAIL_CANCEL_REQUEST_TEAM_SUBJECT
  return out as ConsultationCopy
}

