'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { checklistFromFormData, checklistSummaryRows, missingFields, parseChecklistDraft, type Checklist } from '@/lib/consultation/checklist'
import * as copy from '@/lib/consultation/copy'
import { sendConsultationMail, TEAM_INBOX } from '@/lib/consultation/mail'
import { isPreAgreement, OPEN_REQUEST_STATUSES, INTAKE_STATUSES, isIntakeStatus } from '@/lib/consultation/status'
import {
  ConsultationAgreedClientEmail,
  ConsultationAgreedTeamEmail,
  ConsultationLiveBookedTeamEmail,
} from '@/lib/email/templates/consultation'

export type ConsultActionState = { error?: string; saved?: boolean }

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

const CONSULT_COLUMNS =
  'id, request_id, user_id, path, live_method, contact_number, booking_ref, booked_at, checklist, prepared_by, ready_for_review_at, agreed_at, agreed_ip, created_at, updated_at'

async function signedIn() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/** The signed-in user's open website request (not a buyout) and its consultation, if any. */
async function loadOwn(supabase: ServerSupabase, userId: string) {
  const { data: request } = await supabase
    .from('website_requests')
    .select('id, status, business_name, is_buyout')
    .eq('user_id', userId)
    .in('status', [...OPEN_REQUEST_STATUSES])
    .maybeSingle()
  if (!request || request.is_buyout) return { request: null, consultation: null }
  const { data: consultation } = await supabase
    .from('consultations')
    .select(CONSULT_COLUMNS)
    .eq('request_id', request.id)
    .maybeSingle()
  return { request, consultation }
}

/** submitted / in_review -> consultation (service role: clients can't change the status column). */
async function markRequestInConsultation(requestId: string, status: string) {
  if (!isIntakeStatus(status)) return
  const admin = createAdminClient()
  const { error } = await admin
    .from('website_requests')
    .update({ status: 'consultation', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .in('status', [...INTAKE_STATUSES])
  if (error) console.error('[consultation] status update failed', error.message)
}

function revalidateAll() {
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/consultation', 'layout')
  revalidatePath('/admin', 'layout')
}

/** Path A: start (or switch to) the detailed form. */
export async function chooseFormPath(): Promise<void> {
  const { supabase, user } = await signedIn()
  if (!user) redirect('/login')
  const { request, consultation } = await loadOwn(supabase, user.id)
  if (!request || !isPreAgreement(request.status)) redirect('/dashboard/consultation')
  if (!consultation) {
    const { error } = await supabase
      .from('consultations')
      .insert({ request_id: request.id, user_id: user.id, path: 'form', prepared_by: 'client' })
    if (error) throw new Error(error.message)
  } else if (consultation.path !== 'form' && !consultation.agreed_at) {
    const { error } = await supabase
      .from('consultations')
      .update({ path: 'form', live_method: null, ready_for_review_at: null, updated_at: new Date().toISOString() })
      .eq('id', consultation.id)
    if (error) throw new Error(error.message)
  }
  await markRequestInConsultation(request.id, request.status)
  revalidateAll()
  redirect('/dashboard/consultation/details')
}

/** Path A: save a draft ("save and come back") or send it for review (needs every required answer). */
export async function saveConsultationForm(_prev: ConsultActionState, fd: FormData): Promise<ConsultActionState> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'You must be signed in.' }
  const { request, consultation } = await loadOwn(supabase, user.id)
  if (!request || !consultation) return { error: copy.NO_OPEN_REQUEST }
  if (consultation.agreed_at) return { error: copy.LOCKED_AFTER_AGREED }

  const parsed = parseChecklistDraft(checklistFromFormData(fd))
  if (!parsed.ok) return { error: parsed.error }
  const intent = fd.get('intent') === 'review' ? 'review' : 'save'
  if (intent === 'review') {
    const missing = missingFields(parsed.value)
    if (missing.length) return { error: copy.INCOMPLETE_PREFIX + missing.join(', ') + '.' }
  }
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('consultations')
    .update({
      checklist: parsed.value,
      ready_for_review_at: intent === 'review' ? now : null,
      updated_at: now,
    })
    .eq('id', consultation.id)
  if (error) return { error: error.message }
  revalidateAll()
  if (intent === 'review') redirect('/dashboard/consultation/summary')
  return { saved: true }
}

const LIVE_METHODS = ['phone', 'facetime', 'webcam', 'text'] as const
const bookingSchema = z
  .object({
    live_method: z.enum(LIVE_METHODS, { message: 'Choose how you want to talk.' }),
    contact_number: z.string().trim().max(40).optional(),
    consent: z.boolean(),
    booked_at: z.string().trim().optional(),
    booking_ref: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    const needsNumber = v.live_method !== 'webcam'
    const n = v.contact_number ?? ''
    if (needsNumber) {
      const phoneLike = /^\+?[\d\s().-]{7,25}$/.test(n) && n.replace(/\D/g, '').length >= 7
      const appleId = v.live_method === 'facetime' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n)
      if (!phoneLike && !appleId) {
        ctx.addIssue({
          code: 'custom',
          path: ['contact_number'],
          message: v.live_method === 'facetime' ? 'Enter your FaceTime number or Apple ID email.' : 'Enter a valid phone number.',
        })
      }
    }
    if ((v.live_method === 'phone' || v.live_method === 'text') && !v.consent) {
      ctx.addIssue({ code: 'custom', path: ['consent'], message: copy.CONSENT_REQUIRED_ERROR })
    }
    if (!v.booked_at && !v.booking_ref) {
      ctx.addIssue({ code: 'custom', path: ['booked_at'], message: 'Pick a time for your session.' })
    }
    if (v.booked_at && Number.isNaN(Date.parse(v.booked_at))) {
      ctx.addIssue({ code: 'custom', path: ['booked_at'], message: 'Pick a valid time.' })
    }
  })

async function clientIp(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers()
  const ip = (h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim()
  return { ip: ip || null, ua: h.get('user-agent')?.slice(0, 500) ?? null }
}

/** Path B: pick a method, give a number (+ consent for phone/text), and record the booked slot. */
export async function bookLiveSession(_prev: ConsultActionState, fd: FormData): Promise<ConsultActionState> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'You must be signed in.' }
  const { request, consultation } = await loadOwn(supabase, user.id)
  if (!request || !isPreAgreement(request.status)) return { error: copy.NO_OPEN_REQUEST }
  if (consultation?.agreed_at) return { error: copy.LOCKED_AFTER_AGREED }

  const parsed = bookingSchema.safeParse({
    live_method: String(fd.get('live_method') ?? ''),
    contact_number: String(fd.get('contact_number') ?? ''),
    consent: fd.get('consent') === 'on',
    booked_at: String(fd.get('booked_at') ?? ''),
    booking_ref: String(fd.get('booking_ref') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(' ') }
  const v = parsed.data
  const now = new Date().toISOString()
  const bookedAt = v.booked_at ? new Date(v.booked_at).toISOString() : null
  const fields = {
    path: 'live' as const,
    live_method: v.live_method,
    contact_number: v.live_method === 'webcam' ? null : v.contact_number || null,
    booked_at: bookedAt,
    booking_ref: v.booking_ref || null,
    ready_for_review_at: null,
    updated_at: now,
  }

  let consultationId = consultation?.id
  if (!consultationId) {
    const { data, error } = await supabase
      .from('consultations')
      .insert({ request_id: request.id, user_id: user.id, prepared_by: 'client', ...fields })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'Could not save your booking.' }
    consultationId = data.id
  } else {
    const { error } = await supabase.from('consultations').update(fields).eq('id', consultationId)
    if (error) return { error: error.message }
  }

  // Standing consent rule: phone / text contact is logged with a timestamp (append-only table).
  if (v.live_method === 'phone' || v.live_method === 'text') {
    const { ip, ua } = await clientIp()
    const { error } = await supabase.from('consultation_consents').insert({
      consultation_id: consultationId,
      user_id: user.id,
      channel: v.live_method,
      phone_number: v.contact_number!,
      consent_text: v.live_method === 'text' ? copy.TEXT_CONSENT_TEXT : copy.PHONE_CONSENT_TEXT,
      ip,
      user_agent: ua,
    })
    if (error) return { error: error.message }
  }

  await markRequestInConsultation(request.id, request.status)
  await sendConsultationMail({
    to: TEAM_INBOX,
    subject: copy.EMAIL_LIVE_BOOKED_TEAM_SUBJECT(request.business_name),
    template: 'consultation-live-booked-team',
    react: ConsultationLiveBookedTeamEmail({
      businessName: request.business_name,
      clientEmail: user.email ?? '',
      method: copy.LIVE_METHOD_LABELS[v.live_method],
      when: bookedAt,
      bookingRef: v.booking_ref || null,
    }),
  })
  revalidateAll()
  redirect('/dashboard/consultation/live?booked=1')
}

/** "Change something": back to editing (the summary is no longer ready until resent). */
export async function changeSomething(): Promise<void> {
  const { supabase, user } = await signedIn()
  if (!user) redirect('/login')
  const { consultation } = await loadOwn(supabase, user.id)
  if (consultation && !consultation.agreed_at) {
    const { error } = await supabase
      .from('consultations')
      .update({ ready_for_review_at: null, updated_at: new Date().toISOString() })
      .eq('id', consultation.id)
    if (error) throw new Error(error.message)
  }
  revalidateAll()
  redirect('/dashboard/consultation/details')
}

/** "Looks good": the gate. Stamps agreed_at / agreed_ip, moves the request to agreed, alerts the team. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function agreeToSummary(_prev?: ConsultActionState, _fd?: FormData): Promise<ConsultActionState> {
  const { supabase, user } = await signedIn()
  if (!user) return { error: 'You must be signed in.' }
  const { request, consultation } = await loadOwn(supabase, user.id)
  if (!request || !consultation) return { error: copy.NO_OPEN_REQUEST }
  if (consultation.agreed_at) redirect('/dashboard/consultation/summary')
  if (!consultation.ready_for_review_at) return { error: copy.NOT_READY_ERROR }
  const parsed = parseChecklistDraft(consultation.checklist)
  if (!parsed.ok || missingFields(parsed.value).length) return { error: copy.NOT_READY_ERROR }

  const { ip } = await clientIp()
  const admin = createAdminClient()
  const { data: agreedAt, error } = await admin.rpc('agree_consultation_for_user', {
    p_consultation_id: consultation.id,
    p_user_id: user.id,
    p_ip: ip ?? 'unknown',
  })
  if (error) {
    console.error('[consultation] agree failed', error.message)
    return { error: error.message === 'This summary is not ready to agree yet.' ? copy.NOT_READY_ERROR : 'Could not confirm. Try again.' }
  }
  const rows = checklistSummaryRows(parsed.value as Checklist)
  await sendConsultationMail({
    to: TEAM_INBOX,
    subject: copy.EMAIL_AGREED_TEAM_SUBJECT(request.business_name),
    template: 'consultation-agreed-team',
    react: ConsultationAgreedTeamEmail({
      businessName: request.business_name,
      clientEmail: user.email ?? '',
      path: consultation.path,
      agreedAt: String(agreedAt ?? new Date().toISOString()),
      rows,
    }),
  })
  if (user.email) {
    await sendConsultationMail({
      to: user.email,
      subject: copy.EMAIL_AGREED_CLIENT_SUBJECT,
      template: 'consultation-agreed-client',
      react: ConsultationAgreedClientEmail({ businessName: request.business_name, rows }),
    })
  }
  revalidateAll()
  redirect('/dashboard/consultation/summary?agreed=1')
}
