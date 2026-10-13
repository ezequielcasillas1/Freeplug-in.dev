import { createAdminClient } from '@/lib/supabase/admin'
import { assertTemplatesAccess } from '../guard'
import { lockTemplatePickAction } from '../lock-actions'
import { ScrollX, STICKY_FIRST_TD, STICKY_FIRST_TH } from '../ScrollX'

export const dynamic = 'force-dynamic'

/** Customer template picks. "Lock" = Lina approved the pick or a license was recorded. Admin + localhost only. */
export default async function CustomerPicksPage() {
  await assertTemplatesAccess()
  const { data, error } = await createAdminClient()
    .from('website_requests')
    .select('id, business_name, status, business_type, template_choice, envato_item_id, pasted_template_url, template_picked_at, template_locked_at')
    .not('template_choice', 'is', null)
    .order('template_picked_at', { ascending: false })
    .limit(200)
  if (error) return <p className="text-red-700 text-sm">Could not load customer picks.</p>
  const rows = data ?? []
  const ct = (s: string | null) => (s ? new Date(s).toLocaleString('en-US', { timeZone: 'America/Chicago' }) : '—')
  return (
    <div data-testid="customer-picks">
      <h2 className="text-xl font-semibold mb-3">Customer template picks</h2>
      {rows.length === 0 ? <p className="text-sm text-zinc-600">No picks yet.</p> : (
        <ScrollX>
          <table className="min-w-[48rem] w-full text-sm">
            <thead><tr className="text-left bg-zinc-50"><th className={`p-2 ${STICKY_FIRST_TH}`}>Business</th><th>Status</th><th>Type</th><th>Pick</th><th>Picked (CT)</th><th>Locked</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className={`p-2 ${STICKY_FIRST_TD}`}>{r.business_name}</td>
                  <td>{r.status}</td>
                  <td>{r.business_type ?? '—'}</td>
                  <td>{r.template_choice === 'envato_catalog' ? `Envato #${r.envato_item_id}` : r.template_choice === 'client_pasted' ? <a className="underline" href={r.pasted_template_url ?? '#'} target="_blank" rel="noreferrer">pasted link</a> : '72 After picks'}</td>
                  <td>{ct(r.template_picked_at)}</td>
                  <td>{r.template_locked_at ? ct(r.template_locked_at) : (
                    <form action={lockTemplatePickAction}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <button type="submit" className="min-h-[44px] px-3 text-[#ba3d3d] underline">Lock pick</button>
                    </form>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      )}
    </div>
  )
}
