/** Admin-only labels for change requests (never shown to customers). */
export const ADMIN_CHANGE_REQUEST_COLUMNS =
  'id, user_id, website_request_id, change_type, page, description, photo_name, plan_step, billing, status, decision_note, pr_url, decided_at, notified_at, notify_error, created_at, updated_at, website_requests(business_name)'

export type AdminChangeRequest = {
  id: string
  user_id: string
  website_request_id: string | null
  change_type: string
  page: string
  description: string
  photo_name: string | null
  plan_step: string | null
  billing: string
  status: string
  decision_note: string | null
  pr_url: string | null
  decided_at: string | null
  notified_at: string | null
  notify_error: string | null
  created_at: string
  updated_at: string
  website_requests: { business_name: string | null } | { business_name: string | null }[] | null
}

export function businessNameOf(row: Pick<AdminChangeRequest, 'website_requests'>): string {
  const wr = Array.isArray(row.website_requests) ? row.website_requests[0] : row.website_requests
  return wr?.business_name?.trim() || '—'
}

export const ADMIN_STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending review',
  approved: 'Approved',
  declined: 'Declined',
}

export const ADMIN_BILLING_LABEL: Record<string, string> = {
  included: 'Included (a use is left)',
  paid_addon: 'No edits left (edit pack $5)',
  quote: 'Maintenance quote first',
  unknown: 'Unknown',
}

export function adminNotifyLine(row: Pick<AdminChangeRequest, 'notified_at' | 'notify_error'>): string {
  if (row.notified_at) return `Sent ${new Date(row.notified_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT`
  if (row.notify_error) return row.notify_error.startsWith('Not sent') ? row.notify_error : `Not sent: ${row.notify_error}`
  return 'Not sent yet'
}
