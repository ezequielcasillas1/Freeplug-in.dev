import { isLinkUsable } from './token'

export type AdminOutreachTone = 'grey' | 'amber' | 'green'

export type AdminOutreachSiteState = {
  expires_at: string
  revoked_at: string | null
  declined_at: string | null
  claimed_by: string | null
  publish_status: string
}

/** Admin list badge (Lina: grey / amber / green, never red). */
export function adminOutreachStatus(
  s: AdminOutreachSiteState,
  now: Date = new Date()
): { label: string; tone: AdminOutreachTone } {
  if (s.publish_status === 'live') return { label: 'Live', tone: 'green' }
  if (s.claimed_by) return { label: 'Claimed, waiting to publish', tone: 'amber' }
  if (s.revoked_at) return { label: 'Revoked', tone: 'grey' }
  if (!isLinkUsable(s, now)) return { label: 'Expired', tone: 'grey' }
  if (s.declined_at) return { label: 'Declined', tone: 'grey' }
  return { label: 'Preview sent', tone: 'grey' }
}

export const ADMIN_TONE_CLASSES: Record<AdminOutreachTone, string> = {
  grey: 'bg-gray-100 text-gray-600',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-green-50 text-green-700',
}
