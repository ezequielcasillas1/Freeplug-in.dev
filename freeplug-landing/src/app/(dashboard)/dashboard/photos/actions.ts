'use server'

import { createClient } from '@/lib/supabase/server'
import { startCustomerPhotoBatch } from '@/lib/outreach/server'
import { customerMessage } from '@/lib/outreach/errors'

/**
 * First photo of a dashboard batch (FormData: id, file). The pending submission is created only
 * when this photo is valid (Vera QA #8); the rest of the batch uploads to the returned id.
 */
export async function startPhotoBatchAction(
  formData: FormData
): Promise<{ ok: true; submissionId: string | null; photoId: string } | { ok: false; code?: string; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'expired', error: customerMessage('expired') }
  const res = await startCustomerPhotoBatch(user.id, formData.get('id'), formData.get('file'))
  return res.ok ? res : { ok: false, code: res.code, error: customerMessage(res.code) }
}
