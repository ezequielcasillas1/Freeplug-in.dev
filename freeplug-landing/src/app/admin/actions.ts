'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAdminAccess } from '@/lib/admin/guard'
import { sendSmtpMail } from '@/lib/admin/mail'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const result = await sendSmtpMail({
    to: parsed.data.to,
    subject: parsed.data.subject,
    text: parsed.data.body,
  })
  if (!result.ok) return result
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

/** Whole USD; empty string clears target (dashboard hides progress until set again). */
export async function adminSetProfileWebsiteValueTarget(
  profileId: string,
  targetDollarsRaw: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdminAccess()
  if (!uuidSchema.safeParse(profileId).success) {
    return { ok: false, error: 'Invalid profile id' }
  }
  const t = targetDollarsRaw.trim()
  let website_value_target_cents: number | null
  if (t === '') {
    website_value_target_cents = null
  } else {
    const n = Number(t)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 500_000) {
      return { ok: false, error: 'Use whole dollars from 0 to 500,000, or leave empty to clear.' }
    }
    website_value_target_cents = n * 100
  }
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Admin client unavailable' }
  }
  const { error } = await admin
    .from('profiles')
    .update({
      website_value_target_cents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin', 'layout')
  revalidatePath('/dashboard')
  return { ok: true }
}

const transferNotesMax = 12_000

export async function adminSetProfileWebsiteTransferNotes(
  profileId: string,
  notesRaw: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdminAccess()
  if (!uuidSchema.safeParse(profileId).success) {
    return { ok: false, error: 'Invalid profile id' }
  }
  if (notesRaw.length > transferNotesMax) {
    return { ok: false, error: `Notes too long (max ${transferNotesMax} characters).` }
  }
  const notes = notesRaw.trim() === '' ? null : notesRaw
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Admin client unavailable' }
  }
  const { error } = await admin
    .from('profiles')
    .update({
      website_transfer_notes: notes,
      website_transfer_acknowledged_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin', 'layout')
  revalidatePath('/dashboard')
  return { ok: true }
}
