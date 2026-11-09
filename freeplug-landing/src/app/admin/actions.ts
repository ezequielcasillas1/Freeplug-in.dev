'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAdminAccess } from '@/lib/admin/guard'
import { sendAdminMail } from '@/lib/admin/mail'
import { publicMailError } from '@/lib/email/mailer'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseBuyoutPriceInput } from '@/lib/buyout/buyout'
import { getUserEntitlements } from '@/lib/plans/user-entitlements'
import { getStripe } from '@/lib/stripe/server'
import { subscriptionPeriodStart } from '@/lib/stripe/subscription-dates'
import { recordIncludedEdit } from '@/lib/plans/included-edits'
import { nextBusinessDayDue } from '@/lib/plans/due-by'
import { redirect } from 'next/navigation'
import { expireUnsellableCheckoutSessions, type ExpireUnsellableReport } from '@/lib/stripe/expire-unsellable-checkouts'

const STATUSES = ['submitted', 'in_review', 'closed'] as const

const sendMailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1, 'Subject required').max(300),
  body: z.string().min(1, 'Message required').max(50_000),
})

export async function adminSendCustomerEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdminAccess()
  const parsed = sendMailSchema.safeParse({ to, subject, body })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(' ') }
  }
  const result = await sendAdminMail({
    to: parsed.data.to,
    subject: parsed.data.subject,
    text: parsed.data.body,
  })
  if (!result.ok) return { ok: false, error: publicMailError(result.error) }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function adminSetWebsiteRequestStatus(
  requestId: string,
  status: (typeof STATUSES)[number]
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdminAccess()
  if (!STATUSES.includes(status)) {
    return { ok: false, error: 'Invalid status' }
  }
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Admin client unavailable' }
  }
  const { error } = await admin
    .from('website_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin', 'layout')
  revalidatePath('/dashboard')
  return { ok: true }
}

const uuidSchema = z.string().uuid()

/** Long ban (~100y). Use unban to restore. */
export async function adminBanUser(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdminAccess()
  if (!uuidSchema.safeParse(userId).success) {
    return { ok: false, error: 'Invalid user id' }
  }
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Admin client unavailable' }
  }
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function adminUnbanUser(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdminAccess()
  if (!uuidSchema.safeParse(userId).success) {
    return { ok: false, error: 'Invalid user id' }
  }
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Admin client unavailable' }
  }
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function adminDeleteUser(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdminAccess()
  if (!uuidSchema.safeParse(userId).success) {
    return { ok: false, error: 'Invalid user id' }
  }
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Admin client unavailable' }
  }
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin', 'layout')
  revalidatePath('/dashboard')
  return { ok: true }
}

/** QA only: set `ADMIN_ALLOW_ADJUST_CUMULATIVE_PAID=true` — does not write billing_ledger. */
/** int4 cents ceiling in whole dollars (floor(2147483647 / 100)). */
const CUMULATIVE_PAID_MAX_DOLLARS = 21_474_836

export async function adminSetProfileCumulativeWebsiteValuePaid(
  profileId: string,
  dollarsRaw: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (process.env.ADMIN_ALLOW_ADJUST_CUMULATIVE_PAID !== 'true') {
    return { ok: false, error: 'Cumulative paid override is disabled.' }
  }
  await assertAdminAccess()
  if (!uuidSchema.safeParse(profileId).success) {
    return { ok: false, error: 'Invalid profile id' }
  }
  // Oct 19 (Cheke): QA override is whole dollars from $0 up, no cap (not a buyout price).
  const t = String(dollarsRaw ?? '').trim().replace(/^\$\s*/, '').replace(/,(?=\d{3}(\D|$))/g, '')
  const n = Number(t)
  if (!/^\d+$/.test(t) || !Number.isSafeInteger(n * 100)) {
    return { ok: false, error: 'Enter a whole-dollar amount of $0 or more.' }
  }
  // The column is int4 cents (max 2,147,483,647), so the most it holds is $21,474,836.
  if (n > CUMULATIVE_PAID_MAX_DOLLARS) {
    return { ok: false, error: 'Enter a whole-dollar amount up to $21,474,836.' }
  }
  const cumulative_website_value_paid_cents = n * 100
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Admin client unavailable' }
  }
  const { error } = await admin
    .from('profiles')
    .update({
      cumulative_website_value_paid_cents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin', 'layout')
  revalidatePath('/dashboard')
  return { ok: true }
}

/**
 * Owner sets the buyout price on a buyout request. Saved to website_requests.buyout_price_cents
 * (admin-only column, service-role client; customers can't write it). Whole dollars in, cents stored.
 * The request notes are not touched.
 */
export async function adminSetBuyoutPrice(
  requestId: string,
  dollarsRaw: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdminAccess()
  if (!uuidSchema.safeParse(requestId).success) {
    return { ok: false, error: 'Invalid request id' }
  }
  const price = parseBuyoutPriceInput(dollarsRaw)
  if (!price.ok) return price
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Admin client unavailable' }
  }
  const { data: row, error: readErr } = await admin
    .from('website_requests')
    .select('is_buyout')
    .eq('id', requestId)
    .maybeSingle()
  if (readErr) return { ok: false, error: readErr.message }
  // is_buyout is the only buyout signal (never the notes line). The database also refuses a price
  // on a non-buyout row (website_requests_buyout_price_requires_is_buyout).
  if (!row || row.is_buyout !== true) {
    return { ok: false, error: 'Not a buyout request' }
  }
  const { error } = await admin
    .from('website_requests')
    .update({ buyout_price_cents: price.cents, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('is_buyout', true)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin', 'layout')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/cancel')
  return { ok: true }
}

/**
 * Hosting ladder (admin only): mark a request as a small edit.
 *   * Fast lane and up: sets website_requests.due_by to the end of the next business day.
 *   * useIncludedEdit: also records one of the plan's included edits for the current billing period in
 *     included_edit_uses (the plan's monthly edits, edit-allowance.ts).
 * Entitlements are read from Stripe (lookup key / metadata, or the grandfathered add-on).
 */
export async function adminMarkSmallEdit(
  requestId: string,
  opts: { useIncludedEdit: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdminAccess()
  if (!uuidSchema.safeParse(requestId).success) return { ok: false, error: 'Invalid request id' }
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Admin client unavailable' }
  }
  const { data: req, error: reqErr } = await admin
    .from('website_requests')
    .select('id, user_id, status')
    .eq('id', requestId)
    .maybeSingle()
  if (reqErr || !req) return { ok: false, error: reqErr?.message ?? 'Request not found' }
  const { data: prof } = await admin.from('profiles').select('stripe_customer_id').eq('id', req.user_id).maybeSingle()
  const customerId = (prof?.stripe_customer_id as string | null) ?? null
  if (!customerId) return { ok: false, error: 'This customer has no hosting plan.' }

  let ent, periodStart: Date | null = null
  try {
    const stripe = getStripe()
    // Perks from the webhook-written snapshot (Stripe only for a never-synced profile).
    ent = (await getUserEntitlements(admin, req.user_id as string, customerId, stripe)).entitlements
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 10 })
    periodStart = subs.data[0] ? subscriptionPeriodStart(subs.data[0]) : null
  } catch (e) {
    return { ok: false, error: `Stripe lookup failed: ${e instanceof Error ? e.message : String(e)}` }
  }

  if (opts.useIncludedEdit) {
    const res = await recordIncludedEdit(
      {
        async insertUse(row) {
          const { error } = await admin.from('included_edit_uses').insert(row)
          return error ? { code: error.code, message: error.message } : null
        },
      },
      { userId: req.user_id as string, requestId, includedEditsPerMonth: ent.includedEditsPerMonth, periodStart }
    )
    if (!res.ok) return { ok: false, error: res.message }
  }

  if (ent.nextBusinessDayEdits) {
    const { error } = await admin
      .from('website_requests')
      .update({ due_by: nextBusinessDayDue(new Date()).toISOString() })
      .eq('id', requestId)
    if (error) return { ok: false, error: error.message }
  } else if (!opts.useIncludedEdit) {
    return { ok: false, error: "This customer's plan doesn't include next-business-day edits." }
  }
  revalidatePath('/admin', 'layout')
  revalidatePath('/dashboard')
  return { ok: true }
}

/**
 * Hosting ladder (Aria, Oct 3 12:56): after a step's sellable flag is turned off in ladder.ts,
 * expire every open Checkout Session for that step so it can't be paid. Idempotent: run it again
 * and it finds nothing more to do (sessions that closed meanwhile are reported, not errors).
 */
export async function adminExpireUnsellableCheckouts(): Promise<
  { ok: true; report: ExpireUnsellableReport } | { ok: false; error: string }
> {
  await assertAdminAccess()
  try {
    const report = await expireUnsellableCheckoutSessions(getStripe())
    return { ok: true, report }
  } catch (e) {
    console.error('[admin] expire unsellable checkouts', e instanceof Error ? e.message : e)
    return { ok: false, error: 'Could not reach Stripe. Try again.' }
  }
}

/** Form version for Admin > Customers: runs the expiry and comes back with the counts. */
export async function adminExpireUnsellableCheckoutsForm(): Promise<void> {
  const r = await adminExpireUnsellableCheckouts()
  redirect(
    r.ok
      ? `/admin/customers?checkouts_expired=${r.report.expired.length}&checkouts_closed=${r.report.alreadyClosed.length}&checkouts_checked=${r.report.checked}`
      : '/admin/customers?checkouts_error=1'
  )
}

/** Clears the "bought a step not sold" badge (plan_unsold_purchases.reviewed_at). The plan is untouched. */
export async function adminMarkUnsoldPurchaseReviewed(formData: FormData): Promise<void> {
  await assertAdminAccess()
  const id = uuidSchema.safeParse(formData.get('id'))
  if (!id.success) return
  const admin = createAdminClient()
  const { error } = await admin
    .from('plan_unsold_purchases')
    .update({ reviewed_at: new Date().toISOString() })
    .eq('id', id.data)
    .is('reviewed_at', null)
  if (error) console.error('[admin] mark unsold purchase reviewed', error.message)
  revalidatePath('/admin/customers')
}
