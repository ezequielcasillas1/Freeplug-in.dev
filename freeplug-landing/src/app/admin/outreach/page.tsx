import type { Metadata } from 'next'
import { adminListDomainRequests, adminListOutreachSites } from '@/lib/outreach/server'
import { adminOutreachStatus } from '@/lib/outreach/status'
import { formatMonthly, resolveOutreachPlan } from '@/lib/outreach/plan'
import { AdminOutreachRow, type AdminOutreachRowView } from './AdminOutreachRow'
import { NewOutreachSiteForm } from './NewOutreachSiteForm'
import { CleanupPhotosButton, MarkDomainDoneButton } from './AdminOutreachExtras'

export const metadata: Metadata = { title: 'Outreach | Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminOutreachPage() {
  const [sites, domains] = await Promise.all([adminListOutreachSites(), adminListDomainRequests()])
  const rows: AdminOutreachRowView[] = sites.map((s) => {
    const plan = resolveOutreachPlan(s.plan_hosting_cents, s.plan_addon_tier ?? 'none')
    return {
      id: s.id,
      businessName: s.business_name,
      status: adminOutreachStatus(s),
      expiresAt: s.expires_at,
      claimerEmail: s.claimerEmail,
      planLine: plan ? formatMonthly(plan.totalCents) + (plan.addon ? ` (incl. ${plan.addon.name})` : '') : null,
      cardSaved: Boolean(s.setup_completed_at),
      live: s.publish_status === 'live',
      liveUrl: s.live_url,
      publishStatus: s.publish_status,
      publishError: s.publish_error,
      photoCount: s.photoCount,
      storedApprovedPhotoCount: s.storedApprovedPhotoCount,
      customerConfirmedAt: s.customerConfirmedAt,
      submissions: s.pendingSubmissions.map((p) => ({
        id: p.id,
        source: p.source,
        fields: p.fields,
        services: p.services,
        photoCount: p.photoCount,
        photosMoved: p.photosMoved,
        submittedAt: p.submitted_at,
        stale: p.stale,
      })),
      closedPreview: s.closedPreviewSubmissions.map((c) => ({ id: c.id, submittedAt: c.submitted_at, outcome: c.outcome })),
      changes: s.pendingChanges.map((c) => ({ id: c.id, changeType: c.change_type, description: c.description, createdAt: c.created_at })),
    }
  })
  const openDomains = domains.filter((d) => d.status === 'pending')

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-gray-900">New outreach site</h1>
        <NewOutreachSiteForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Outreach sites ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-600">No outreach sites yet.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <AdminOutreachRow key={r.id} row={r} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Domain requests ({openDomains.length} open)</h2>
        {domains.length === 0 ? (
          <p className="text-sm text-gray-600">No domain requests.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {domains.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="text-gray-900">{d.email ?? d.user_id}</span>
                <span className="text-gray-600">{d.kind === 'have_domain' ? `Has a domain: ${d.domain}` : 'Needs a domain'}</span>
                <span className="text-xs text-gray-500">{new Date(d.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })}</span>
                {d.status === 'pending' ? <MarkDomainDoneButton id={d.id} /> : <span className="text-xs text-gray-500">Done</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <CleanupPhotosButton />
      </section>
    </div>
  )
}
