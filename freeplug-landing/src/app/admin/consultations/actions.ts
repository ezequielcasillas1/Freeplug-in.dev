'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAdminAccess } from '@/lib/admin/guard'
import { getAuthSummariesByUserIds } from '@/lib/admin/auth-users'
import { checklistFromFormData, missingFields, parseChecklistDraft } from '@/lib/consultation/checklist'
import * as copy from '@/lib/consultation/copy'
import { sendConsultationMail } from '@/lib/consultation/mail'
import { ConsultationSummaryReadyEmail } from '@/lib/email/templates/consultation'
import { createAdminClient } from '@/lib/supabase/admin'

export type AdminConsultState = { ok?: boolean; error?: string; message?: string }

const uuid = z.string().uuid()

/**
 * Team fills the checklist after a live session (also usable to tidy a form-path draft). intent
 * 'save' keeps it as a team draft; 'ready' sends it to the client as "Review your summary".
 */
export async function adminSaveConsultationChecklist(_prev: AdminConsultState, fd: FormData): Promise<AdminConsultState> {
  await assertAdminAccess()
  const id = String(fd.get('consultation_id') ?? '')
  if (!uuid.safeParse(id).success) return { error: 'Invalid consultation id' }
  const parsed = parseChecklistDraft(checklistFromFormData(fd))
  if (!parsed.ok) return { error: parsed.error }
  const ready = fd.get('intent') === 'ready'
  if (ready) {
    const missing = missingFields(parsed.value)
    if (missing.length) return { error: copy.INCOMPLETE_PREFIX + missing.join(', ') + '.' }
  }
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { error: 'Admin client unavailable' }
  }
  const { error } = await admin.rpc('admin_save_consultation_checklist', {
    p_consultation_id: id,
    p_checklist: parsed.value,
    p_ready: ready,
  })
  if (error) return { error: error.message }

  if (ready) {
    const { data: row } = await admin
      .from('consultations')
      .select('user_id, website_requests(business_name)')
      .eq('id', id)
      .maybeSingle()
    if (row) {
      const auth = await getAuthSummariesByUserIds(admin, [row.user_id as string])
      const email = auth.get(row.user_id as string)?.email
      const req = row.website_requests as unknown as { business_name: string } | null
      if (email) {
        await sendConsultationMail({
          to: email,
          subject: copy.EMAIL_SUMMARY_READY_SUBJECT,
          template: 'consultation-summary-ready',
          react: ConsultationSummaryReadyEmail({ businessName: req?.business_name ?? 'your business' }),
        })
      }
    }
  }
  revalidatePath('/admin', 'layout')
  revalidatePath('/dashboard', 'layout')
  return { ok: true, message: ready ? 'Sent to the client for review (email logged, test mode).' : 'Saved.' }
}
