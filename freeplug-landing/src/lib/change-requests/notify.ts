import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { emailBaseUrl } from '@/lib/site'
import { getUserEntitlements } from '@/lib/plans/user-entitlements'
import { periodStartDate } from '@/lib/plans/included-edits'
import { getStripe } from '@/lib/stripe/server'
import { subscriptionPeriodStart } from '@/lib/stripe/subscription-dates'
import { classifyChangeBilling, sizeOfChangeType, type ChangeBilling } from './billing'
import { buildChangeRequestPayload, type PayloadSource } from './payload'
import {
  CHANGE_WEBHOOK_NOT_CONFIGURED,
  changeWebhookConfig,
  postChangeRequestWebhook,
  type WebhookConfig,
  type WebhookResult,
} from './webhook'

/**
 * Server side of a help-chat change request, after the customer's submit has already answered:
 * classify billing (service role, never the customer), then POST the webhook once and record
 * notified_at or notify_error. Also used by the /admin "Resend" button. Never throws to the caller.
 * The service-role client is passed in by an allowlisted caller (eslint: one service-role path).
 */
type Admin = Pick<SupabaseClient, 'from'>

const LOG = '[change-requests]'
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** billing + plan_step for a request. Any failed lookup gives `unknown` (never a guess). */
export async function classifyChangeRequest(
  admin: Admin,
  userId: string,
  changeType: string
): Promise<{ billing: ChangeBilling; planStep: string | null }> {
  try {
    const { data: prof, error } = await admin.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle()
    if (error) throw new Error(error.message)
    const customerId = (prof?.stripe_customer_id as string | null | undefined) ?? null
    if (!customerId) return { billing: 'unknown', planStep: null }
    const ent = (await getUserEntitlements(admin, userId, customerId)).entitlements
    const planStep = ent.step?.id ?? null
    const size = sizeOfChangeType(changeType)
    if (!size) return { billing: 'unknown', planStep }

    // The period the admin "small edit" button counts in: the ACTIVE subscription.
    const subs = await getStripe().subscriptions.list({ customer: customerId, status: 'active', limit: 10 })
    const period = periodStartDate(subs.data[0] ? subscriptionPeriodStart(subs.data[0]) : null)
    let smallEditsUsed: number | null = null
    if (period) {
      const small = await admin.from('included_edit_uses').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('period_start', period)
      smallEditsUsed = small.error ? null : (small.count ?? 0)
    }
    return { billing: classifyChangeBilling({ size, entitlements: ent, smallEditsUsed }), planStep }
  } catch (e) {
    console.error(`${LOG} billing lookup failed; billing=unknown`, errText(e))
    return { billing: 'unknown', planStep: null }
  }
}

export type DeliverResult = WebhookResult | { ok: false; skipped: true; error: string }

type RowWithBusiness = Omit<PayloadSource, 'business_name'> & {
  website_requests: { business_name: string | null } | { business_name: string | null }[] | null
}

/** Builds the v1 payload from the stored row and POSTs it once; records the result on the row. */
export async function deliverChangeRequest(
  admin: Admin,
  requestId: string,
  opts: { config?: WebhookConfig | null; fetchImpl?: typeof fetch; timeoutMs?: number; siteBase?: string } = {}
): Promise<DeliverResult> {
  const config = opts.config === undefined ? changeWebhookConfig() : opts.config
  const record = async (patch: { notified_at?: string | null; notify_error: string | null }) => {
    const { error } = await admin.from('change_requests').update(patch).eq('id', requestId)
    if (error) console.error(`${LOG} could not record the webhook result`, requestId, error.message)
  }
  if (!config) {
    console.info(`${LOG} webhook not configured (CHANGE_APPROVAL_WEBHOOK_URL / CHANGE_APPROVAL_WEBHOOK_KEY unset); skipped`, requestId)
    await record({ notify_error: CHANGE_WEBHOOK_NOT_CONFIGURED })
    return { ok: false, skipped: true, error: CHANGE_WEBHOOK_NOT_CONFIGURED }
  }
  const { data, error } = await admin
    .from('change_requests')
    .select('id, change_type, page, description, photo_name, plan_step, billing, created_at, website_requests(business_name)')
    .eq('id', requestId)
    .maybeSingle()
  if (error || !data) {
    const msg = error ? 'Could not read the request' : 'Request not found'
    console.error(`${LOG} ${msg}`, requestId, error?.message ?? '')
    return { ok: false, error: msg }
  }
  const row = data as unknown as RowWithBusiness
  const wr = Array.isArray(row.website_requests) ? row.website_requests[0] : row.website_requests
  const payload = buildChangeRequestPayload({ ...row, business_name: wr?.business_name ?? null }, opts.siteBase ?? emailBaseUrl())
  const res = await postChangeRequestWebhook(config, payload, { fetchImpl: opts.fetchImpl, timeoutMs: opts.timeoutMs })
  if (res.ok) {
    await record({ notified_at: new Date().toISOString(), notify_error: null })
    console.info(`${LOG} webhook delivered`, requestId, res.status)
  } else {
    await record({ notify_error: res.error })
    console.warn(`${LOG} webhook failed`, requestId, res.error)
  }
  return res
}

/** Background task for a new request (runs after the customer's response). */
export async function notifyNewChangeRequest(
  admin: Admin,
  input: { requestId: string; userId: string; changeType: string; websiteRequestId?: string | null },
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<DeliverResult> {
  // The row is inserted before the notes append; when that append started a new website request,
  // link it here (service role; only if the row has none, and only the same user's request).
  if (input.websiteRequestId) {
    const { error: linkErr } = await admin
      .from('change_requests')
      .update({ website_request_id: input.websiteRequestId })
      .eq('id', input.requestId)
      .eq('user_id', input.userId)
      .is('website_request_id', null)
    if (linkErr) console.error(`${LOG} could not link the website request`, input.requestId, linkErr.message)
  }
  const { billing, planStep } = await classifyChangeRequest(admin, input.userId, input.changeType)
  const { error } = await admin.from('change_requests').update({ billing, plan_step: planStep }).eq('id', input.requestId)
  if (error) console.error(`${LOG} could not save billing`, input.requestId, error.message)
  return deliverChangeRequest(admin, input.requestId, { fetchImpl: opts.fetchImpl, timeoutMs: opts.timeoutMs })
}
