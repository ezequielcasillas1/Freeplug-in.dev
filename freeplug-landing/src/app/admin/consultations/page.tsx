import { getAuthSummariesByUserIds } from '@/lib/admin/auth-users'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseChecklistDraft } from '@/lib/consultation/checklist'
import { consultationStage, STATUS_LABELS, type WebsiteRequestStatus } from '@/lib/consultation/status'
import { LIVE_METHOD_LABELS } from '@/lib/consultation/copy'
import type { ConsultationConsentRow, ConsultationRow } from '@/types/supabase'
import { AdminConfigError } from '../AdminConfigError'
import { AdminConsultationCard, type AdminConsultationView } from './AdminConsultationCard'

const STAGE_LABEL = {
  choose: 'Not started',
  form_draft: 'Client filling form',
  live_booking: 'Live: not booked',
  live_waiting: 'Live: booked, needs checklist',
  review: 'Waiting for client review',
  agreed: 'Agreed',
} as const

/** Order: what the team must act on first (live sessions needing a checklist), then the rest. */
const STAGE_ORDER = ['live_waiting', 'live_booking', 'review', 'form_draft', 'agreed', 'choose'] as const

export default async function AdminConsultationsPage() {
  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return <AdminConfigError hint={process.env.NODE_ENV === 'development' ? (e instanceof Error ? e.message : String(e)) : null} />
  }
  const { data, error } = await admin
    .from('consultations')
    .select('*, website_requests(business_name, status, contact_phone)')
    .order('created_at', { ascending: true })
  if (error) return <p className="text-red-700 text-sm">{error.message}</p>
  const rows = (data ?? []) as (ConsultationRow & {
    website_requests: { business_name: string; status: WebsiteRequestStatus; contact_phone: string | null } | null
  })[]

  const ids = rows.map((r) => r.id)
  const consents = new Map<string, ConsultationConsentRow[]>()
  if (ids.length) {
    const { data: cs } = await admin.from('consultation_consents').select('*').in('consultation_id', ids).order('consented_at')
    for (const c of (cs ?? []) as ConsultationConsentRow[]) consents.set(c.consultation_id, [...(consents.get(c.consultation_id) ?? []), c])
  }
  const auth = await getAuthSummariesByUserIds(admin, rows.map((r) => r.user_id))

  const views: AdminConsultationView[] = rows
    .map((r) => {
      const stage = consultationStage(r)
      const parsed = parseChecklistDraft(r.checklist)
      return {
        id: r.id,
        businessName: r.website_requests?.business_name ?? '—',
        requestStatus: r.website_requests ? STATUS_LABELS[r.website_requests.status] ?? r.website_requests.status : '—',
        clientEmail: auth.get(r.user_id)?.email ?? null,
        path: r.path,
        method: r.live_method ? LIVE_METHOD_LABELS[r.live_method] : null,
        contactNumber: r.contact_number,
        bookedAt: r.booked_at,
        bookingRef: r.booking_ref,
        preparedBy: r.prepared_by,
        stage,
        stageLabel: STAGE_LABEL[stage],
        readyAt: r.ready_for_review_at,
        agreedAt: r.agreed_at,
        agreedIp: r.agreed_ip,
        checklist: parsed.ok ? parsed.value : {},
        consents: (consents.get(r.id) ?? []).map((c) => ({ channel: c.channel, phone: c.phone_number, at: c.consented_at, text: c.consent_text })),
      }
    })
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Consultations</h2>
      <p className="text-sm text-zinc-600 mb-4">
        Live sessions needing a checklist come first. Building can start only after the client clicks Looks good. Emails are logged, not sent (test mode).
      </p>
      {views.length === 0 ? (
        <p className="text-zinc-600 text-sm">No consultations yet.</p>
      ) : (
        <div className="space-y-4">
          {views.map((v) => (
            <AdminConsultationCard key={v.id} view={v} />
          ))}
        </div>
      )}
    </div>
  )
}
