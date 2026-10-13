'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAdminAccess } from '@/lib/admin/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { decisionPatch, parseDecisionForm } from '@/lib/change-requests/decision'
import { deliverChangeRequest } from '@/lib/change-requests/notify'

export type AdminChangeActionState = { ok?: boolean; error?: string; message?: string }

/** Approve / Decline + optional note and PR link. Only a pending request can be decided. */
export async function adminDecideChangeRequest(_prev: AdminChangeActionState, formData: FormData): Promise<AdminChangeActionState> {
  await assertAdminAccess()
  const parsed = parseDecisionForm(formData)
  if (!parsed.ok) return { error: parsed.error }
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Admin client unavailable' }
  }
  const { data, error } = await admin
    .from('change_requests')
    .update(decisionPatch(parsed.value))
    .eq('id', parsed.value.id)
    .eq('status', 'pending_review')
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'This request was already decided (or no longer exists). Reload the page.' }
  revalidatePath('/admin/change-requests', 'layout')
  revalidatePath('/dashboard')
  return { ok: true, message: parsed.value.decision === 'approved' ? 'Marked approved.' : 'Marked not approved.' }
}

const idSchema = z.string().uuid()

/** "Resend": POSTs the same v1 payload once more (request_id is the receiver's idempotency key). */
export async function adminResendChangeRequest(_prev: AdminChangeActionState, formData: FormData): Promise<AdminChangeActionState> {
  await assertAdminAccess()
  const id = idSchema.safeParse(formData.get('id'))
  if (!id.success) return { error: 'Invalid request id' }
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Admin client unavailable' }
  }
  const res = await deliverChangeRequest(admin, id.data)
  revalidatePath('/admin/change-requests', 'layout')
  return res.ok ? { ok: true, message: `Sent (HTTP ${res.status}).` } : { error: `Not sent: ${res.error.replace(/^Not sent: /, '')}` }
}
