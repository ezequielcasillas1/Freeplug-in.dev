import { scrubForWebhook } from './scrub'
import type { ChangeBilling } from './billing'

/**
 * Webhook payload v1 (Aria spec, item 3). Exactly these keys: no email, phone, user id, Stripe id
 * or IP. request_id doubles as the idempotency key. The description (and the free-text page name,
 * also typed in the chat) is scrubbed here only; the stored row keeps the original.
 */
export type ChangeRequestPayloadV1 = {
  v: 1
  event: 'change_request.created'
  request_id: string
  business_name: string
  change_type: string
  page: string
  description: string
  has_photo: boolean
  plan_step: string | null
  billing: ChangeBilling
  created_at: string
  admin_url: string
}

export const PAYLOAD_V1_KEYS = [
  'v', 'event', 'request_id', 'business_name', 'change_type', 'page', 'description', 'has_photo', 'plan_step', 'billing', 'created_at', 'admin_url',
] as const

export type PayloadSource = {
  id: string
  business_name: string | null
  change_type: string
  page: string
  description: string
  photo_name: string | null
  plan_step: string | null
  billing: ChangeBilling
  created_at: string
}

export function adminChangeRequestUrl(siteBase: string, requestId: string): string {
  return `${siteBase.replace(/\/+$/, '')}/admin/change-requests/${encodeURIComponent(requestId)}`
}

export function buildChangeRequestPayload(row: PayloadSource, siteBase: string): ChangeRequestPayloadV1 {
  return {
    v: 1,
    event: 'change_request.created',
    request_id: row.id,
    business_name: (row.business_name ?? '').trim(),
    change_type: row.change_type,
    page: scrubForWebhook(row.page),
    description: scrubForWebhook(row.description),
    has_photo: Boolean(row.photo_name?.trim()),
    plan_step: row.plan_step ?? null,
    billing: row.billing,
    created_at: new Date(row.created_at).toISOString(),
    admin_url: adminChangeRequestUrl(siteBase, row.id),
  }
}
