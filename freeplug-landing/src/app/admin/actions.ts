'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAdminAccess } from '@/lib/admin/guard'
import { sendAdminMail } from '@/lib/admin/mail'
import { publicMailError } from '@/lib/email/mailer'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseBuyoutPriceInput } from '@/lib/buyout/buyout'

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
  const t = dollarsRaw.trim()
  const n = Number(t)
  if (t === '' || !Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 500_000) {
    return { ok: false, error: 'Use whole dollars from 0 to 500,000.' }
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
