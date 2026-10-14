import { createAdminClient } from '@/lib/supabase/admin'
import { assertTemplatesAccess } from '../guard'
import { lockTemplatePickAction, unlockTemplatePickAction } from '../lock-actions'
import { isPickWindowOpen } from '@/lib/templates/window'
import { templateDbNow } from '@/lib/templates/server'
import { PickCards, type PickCardRow } from './PickCards'
import { ScrollX, STICKY_FIRST_TD, STICKY_FIRST_TH } from '../ScrollX'

export const dynamic = 'force-dynamic'

/** Customer template picks. "Lock" = Lina approved the pick or a license was recorded. Admin + localhost only. */
export default async function CustomerPicksPage() {
  await assertTemplatesAccess()
  const db = createAdminClient()
  const { data, error } = await db
    .from('website_requests')
    .select('id, business_name, status, business_type, template_choice, envato_item_id, pasted_template_url, template_picked_at, template_locked_at, template_first_picked_at, template_unlocked_until')
    .not('template_choice', 'is', null)
    .order('template_picked_at', { ascending: false })
    .limit(200)
  if (error) return <p className="text-red-700 text-sm">Could not load customer picks.</p>
  const rows = data ?? []
  let now: Date
  try { now = await templateDbNow(db) } catch { return <p className="text-red-700 text-sm">Could not load customer picks.</p> }
  const ct = (s: string | null) => (s ? new Date(s).toLocaleString('en-US', { timeZone: 'America/Chicago' }) : '—')
  const openStatus = (st: string) => st === 'submitted' || st === 'in_review'
  const pickLabel = (r: (typeof rows)[number]) => (r.template_choice === 'envato_catalog' ? `Envato #${r.envato_item_id}` : r.template_choice === 'client_pasted' ? 'pasted link' : '72 After picks')
  const cards: PickCardRow[] = rows.map((r) => {
    const open = isPickWindowOpen(r, now)
    const unlocked = r.template_unlocked_until != null && new Date(r.template_unlocked_until) > now
    return {
      id: r.id,
      business: r.business_name,
      status: r.status,
      type: r.business_type ?? '—',
      pick: pickLabel(r),
      canLock: !r.template_locked_at,
      canUnlock: !r.template_locked_at && openStatus(r.status) && !open,
      note: r.template_locked_at ? `Locked ${ct(r.template_locked_at)}` : open ? `Customer can change${unlocked ? ` (unlocked until ${ct(r.template_unlocked_until)})` : ''}` : null,
    }
  })
  return (
    <div data-testid="customer-picks">
      <h2 className="text-xl font-semibold mb-3">Customer template picks</h2>
      {rows.length === 0 ? <p className="text-sm text-zinc-600">No picks yet.</p> : (
        <>
        <PickCards rows={cards} lock={lockTemplatePickAction} unlock={unlockTemplatePickAction} />
        <div className="hidden sm:block">
        <ScrollX>
          <table className="min-w-[48rem] w-full text-sm">
            <thead><tr className="text-left bg-zinc-50"><th className={`p-2 ${STICKY_FIRST_TH}`}>Business</th><th>Status</th><th>Type</th><th>Pick</th><th>Picked (CT)</th><th>Locked</th><th>Customer can change</th></tr></thead>
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
                  <td data-testid={`window-${r.id}`}>{r.template_locked_at || !(r.status === 'submitted' || r.status === 'in_review') ? '—' : isPickWindowOpen(r, now) ? (
                    <span>Yes{r.template_unlocked_until && new Date(r.template_unlocked_until) > now ? ` (unlocked until ${ct(r.template_unlocked_until)})` : ''}</span>
                  ) : (
                    <form action={unlockTemplatePickAction}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <button type="submit" data-testid="unlock-pick" className="min-h-[44px] px-3 text-[#ba3d3d] underline">Unlock for 1 hour</button>
                    </form>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
        </div>
        </>
      )}
    </div>
  )
}
