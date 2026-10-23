import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { parseChecklistDraft, type Checklist } from '@/lib/consultation/checklist'
import { OPEN_REQUEST_STATUSES } from '@/lib/consultation/status'
import type { ConsultationRow } from '@/types/supabase'

export type OwnConsultation = {
  userId: string
  email: string | null
  request: { id: string; status: string; business_name: string } | null
  consultation: ConsultationRow | null
  checklist: Checklist
}

/** Page loader: the signed-in user's open (non-buyout) website request and its consultation. */
export async function loadOwnConsultation(): Promise<OwnConsultation | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: request } = await supabase
    .from('website_requests')
    .select('id, status, business_name, is_buyout')
    .eq('user_id', user.id)
    .in('status', [...OPEN_REQUEST_STATUSES])
    .maybeSingle()
  if (!request || request.is_buyout) {
    return { userId: user.id, email: user.email ?? null, request: null, consultation: null, checklist: {} }
  }
  const { data: consultation } = await supabase.from('consultations').select('*').eq('request_id', request.id).maybeSingle()
  const parsed = parseChecklistDraft(consultation?.checklist ?? {})
  return {
    userId: user.id,
    email: user.email ?? null,
    request: { id: request.id, status: request.status, business_name: request.business_name },
    consultation: (consultation as ConsultationRow | null) ?? null,
    checklist: parsed.ok ? parsed.value : {},
  }
}
