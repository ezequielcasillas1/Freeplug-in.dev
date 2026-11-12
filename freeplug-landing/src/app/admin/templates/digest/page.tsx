import { createAdminClient } from '@/lib/supabase/admin'
import { NICHES, NICHE_LABEL } from '@/lib/envato/niche-tags'
import { assertTemplatesAccess } from '../guard'
import { ScrollX, STICKY_FIRST_TD, STICKY_FIRST_TH } from '../ScrollX'
import { isoHoursAgo } from '../view'

export const dynamic = 'force-dynamic'

/** Weekly digest (last 7 days): widens per type, coverage, Needs Lina. Admin + localhost only. Not emailed. */
export default async function TemplatesDigestPage() {
  await assertTemplatesAccess()
  const db = createAdminClient()
  const since = isoHoursAgo(7 * 24)
  const [{ data: widens }, { data: picks }, { count: needsLina }] = await Promise.all([
    db.from('template_widen_log').select('niche').gte('created_at', since),
    db.from('template_shortlist').select('niche, verify_status').eq('active', true),
    db.from('envato_items').select('id', { count: 'exact', head: true }).eq('needs_lina', true).eq('status', 'active'),
  ])
  const w = new Map<string, number>()
  for (const r of widens ?? []) w.set(r.niche, (w.get(r.niche) ?? 0) + 1)
  const c = new Map<string, number>()
  for (const p of picks ?? []) if (p.verify_status === 'confirmed') c.set(p.niche, (c.get(p.niche) ?? 0) + 1)
  return (
    <div data-testid="templates-digest">
      <h2 className="text-xl font-semibold mb-1">Template digest (last 7 days)</h2>
      <p className="text-sm text-zinc-600 mb-3">Needs Lina: {needsLina ?? 0}</p>
      <ScrollX>
        <table className="min-w-[36rem] w-full text-sm">
        <thead><tr className="text-left bg-zinc-50"><th className={`p-2 ${STICKY_FIRST_TH}`}>Type</th><th>Confirmed picks</th><th>Widens</th></tr></thead>
        <tbody>
          {NICHES.map((n) => (
            <tr key={n} className="border-t">
              <td className={`p-2 ${STICKY_FIRST_TD}`}>{NICHE_LABEL[n]}</td>
              <td className={(c.get(n) ?? 0) < 6 ? 'text-red-700' : ''}>{c.get(n) ?? 0}</td>
              <td>{w.get(n) ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </ScrollX>
    </div>
  )
}
