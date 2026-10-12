import { createAdminClient } from '@/lib/supabase/admin'
import { NICHE_LABEL, isNiche } from '@/lib/envato/niche-tags'
import { assertTemplatesAccess } from '../guard'
import { ScrollX, STICKY_FIRST_TD, STICKY_FIRST_TH } from '../ScrollX'

export const dynamic = 'force-dynamic'

/** Every widen (a niche falling back to general templates). Admin + localhost only. */
export default async function WidenLogPage() {
  await assertTemplatesAccess()
  const { data, error } = await createAdminClient()
    .from('template_widen_log')
    .select('id, niche, request_id, actor_email, actor_role, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return <p className="text-red-700 text-sm">Could not load the widen log.</p>
  const rows = data ?? []
  return (
    <div data-testid="widen-log">
      <h2 className="text-xl font-semibold mb-3">Widen log</h2>
      {rows.length === 0 ? <p className="text-sm text-zinc-600">No widens yet.</p> : (
        <ScrollX>
        <table className="min-w-[36rem] w-full text-sm">
          <thead><tr className="text-left bg-zinc-50"><th className={`p-2 ${STICKY_FIRST_TH}`}>When (CT)</th><th>Type</th><th>Who</th><th>Role</th><th>Request</th><th>Reason</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className={`p-2 ${STICKY_FIRST_TD}`}>{new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })}</td>
                <td>{isNiche(r.niche) ? NICHE_LABEL[r.niche] : r.niche}</td>
                <td>{r.actor_email ?? '—'}</td>
                <td>{r.actor_role}</td>
                <td>{r.request_id ?? '—'}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </ScrollX>
      )}
    </div>
  )
}
