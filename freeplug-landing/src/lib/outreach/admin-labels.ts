import type { DetailKey } from './schemas'

/**
 * Admin screens (internal): the field labels the "New outreach site" form uses, shown instead of
 * database keys on the review rows too (Sable, Sep 27 12:35 AM).
 */
export const ADMIN_FIELD_LABELS: Record<DetailKey, string> = {
  phone: 'Phone',
  address: 'Address',
  hours: 'Hours',
  service_area: 'Service area',
  quote_email: 'Quote-request email',
}

export function adminFieldLabel(key: string): string {
  return (ADMIN_FIELD_LABELS as Record<string, string>)[key] ?? key
}

/** Sable 12:35 AM (replaces "(cannot apply)"). */
export const ADMIN_STALE_NOTE = "Older than the customer's confirmed details, so it can't be applied."

/** Sable 1:02 AM: the admin cleanup link for approved photos, and its confirmation. */
export function adminDeletePhotosLabel(n: number): string {
  return n === 1 ? 'Delete 1 approved photo from storage' : `Delete ${n} approved photos from storage`
}
export const ADMIN_DELETE_PHOTOS_CONFIRM =
  "These photos are already on the site. This deletes Freeplug's stored copies and can't be undone."
export const ADMIN_DELETE_PHOTOS_BUTTON = 'Delete photos'

/** Sable 1:18 AM: services on a review row (replaces the literal "~~name~~", Vera r2 bug 8). */
export function adminServiceLabel(s: { name: string; keep: boolean; added: boolean }): string {
  if (!s.keep) return `Remove: ${s.name}`
  return s.added ? `Add: ${s.name}` : s.name
}

/** Sable 1:18 AM: old preview rows whose photos were carried into the customer's row. */
export const ADMIN_PHOTOS_MOVED_NOTE = "These photos moved to the customer's confirmed details, so approve them there."

/** Sable 1:34 AM: Reject on a row with photos asks first. */
export function adminRejectConfirm(n: number): string {
  return n === 1
    ? "Reject these details? This also rejects the 1 photo sent with them, and it can't be approved later."
    : `Reject these details? This also rejects the ${n} photos sent with them, and they can't be approved later.`
}
export const ADMIN_REJECT_CONFIRM_BUTTON = 'Reject details and photos'
export const ADMIN_REJECT_ALREADY_APPLIED = "These details were already applied, so they can't be rejected."

/** Sable 1:36 AM: the grey line of an old preview row closed after the customer's row was reviewed. */
export const ADMIN_CLOSED_APPROVED = "These photos moved to the customer's confirmed details and were approved there."
export const ADMIN_CLOSED_REJECTED = "These photos moved to the customer's confirmed details and were rejected with them."
export const ADMIN_CLOSED_NO_PHOTOS = "Replaced by the customer's confirmed details."
export function adminClosedPreviewLine(outcome: 'applied' | 'rejected' | 'pending' | 'no_photos'): string {
  if (outcome === 'applied') return ADMIN_CLOSED_APPROVED
  if (outcome === 'rejected') return ADMIN_CLOSED_REJECTED
  if (outcome === 'pending') return ADMIN_PHOTOS_MOVED_NOTE
  return ADMIN_CLOSED_NO_PHOTOS
}
