import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminConfigError } from '../AdminConfigError'
import { NICHES, NICHE_LABEL } from '@/lib/envato/niche-tags'
import { CORE_CATEGORIES } from '@/lib/envato/partitions'
import { assertTemplatesAccess } from './guard'
import { decideCleaningAction, importShortlistAction, syncNowAction, widenAction } from './actions'
import { ScrollX, STICKY_FIRST_TD, STICKY_FIRST_TH } from './ScrollX'
import { formatCents, isoHoursAgo, parseFilters, FRESH_HOURS, MIN_PER_TYPE } from './view'
import { envatoTokenConfigured } from '@/lib/envato/client'

export const dynamic = 'force-dynamic'

type SP = Promise<Record<string, string | string[] | undefined>>

type Item = {
  id: number
  name: string
  category: string
  platform: string
  url: string | null
  price_cents: number | null
  extended_price_cents: number | null
  rating: number | null
  rating_count: number | null
  sales: number | null
  updated_at: string | null
  live_preview_url: string | null
  preview_image_url: string | null
  cleaning_match: string | null
}
type Pick = {
  envato_item_id: number
  niche: string
  name: string
  url: string
  demo_url: string | null
  platform: string | null
  verify_status: string
  verify_reason: string | null
  build_note: string | null
  regular_price_cents: number | null
  extended_price_cents: number | null
}

const ITEM_COLS =
  'id, name, category, platform, url, price_cents, extended_price_cents, rating, rating_count, sales, updated_at, live_preview_url, preview_image_url, cleaning_match'

export default async function AdminTemplatesPage({ searchParams }: { searchParams: SP }) {
  await assertTemplatesAccess()
  const f = parseFilters(await searchParams)
  let db
  try {
    db = createAdminClient()
  } catch (e) {
    return <AdminConfigError hint={process.env.NODE_ENV === 'development' ? (e instanceof Error ? e.message : String(e)) : null} />
  }
  const freshSince = isoHoursAgo(FRESH_HOURS)
  const [{ data: lastRun }, { count: needsLinaCount }, { data: allPicks }] = await Promise.all([
    db.from('envato_sync_runs').select('id, started_at, finished_at, complete, calls, items_seen, items_changed, items_removed, error').order('id', { ascending: false }).limit(1).maybeSingle(),
    db.from('envato_items').select('id', { count: 'exact', head: true }).eq('needs_lina', true).eq('status', 'active'),
    db.from('template_shortlist').select('niche, verify_status').eq('active', true),
  ])
  const coverage = new Map<string, number>()
  for (const p of (allPicks ?? []) as Array<{ niche: string; verify_status: string }>) {
    if (p.verify_status === 'confirmed') coverage.set(p.niche, (coverage.get(p.niche) ?? 0) + 1)
  }

  let picks: Pick[] = []
  let items: Item[] = []
  if (f.view === 'needs-lina') {
    const { data } = await db.from('envato_items').select(ITEM_COLS).eq('needs_lina', true).eq('status', 'active').order('name').limit(200)
    items = (data ?? []) as Item[]
  } else if (f.niche) {
    if (f.view === 'shortlist') {
      let q = db.from('template_shortlist').select('envato_item_id, niche, name, url, demo_url, platform, verify_status, verify_reason, build_note, regular_price_cents, extended_price_cents').eq('active', true).eq('niche', f.niche)
      if (f.platform) q = q.eq('platform', f.platform === 'wp' ? 'WP' : 'HTML')
      const { data } = await q.order('verify_status').order('name')
      picks = (data ?? []) as Pick[]
    } else {
      // catalog: niche match; general: widened (logged) view over every local-business item.
      // TODO(phase 2): within one view show each template once, even if it is both a type match and a
      // general fallback (see templates-view.test.ts "dedupes type match + fallback", it.todo).
      let q = db.from('envato_items').select(ITEM_COLS).eq('status', 'active').gte('last_seen_at', freshSince)
      if (f.view === 'catalog') q = q.contains('auto_niches', [f.niche])
      if (f.platform) q = q.eq('platform', f.platform)
      if (f.category) q = q.eq('category', f.category)
      if (f.minRating != null) q = q.gte('rating', f.minRating)
      if (f.minSales != null) q = q.gte('sales', f.minSales)
      if (f.maxPrice != null) q = q.lte('price_cents', f.maxPrice * 100)
      if (f.updatedDays != null) q = q.gte('updated_at', isoHoursAgo(f.updatedDays * 24))
      const { data } = await q.order('sales', { ascending: false, nullsFirst: false }).limit(100)
      items = (data ?? []) as Item[]
    }
  }

  const tab = (view: string, label: string) => {
    const href = view === 'needs-lina' ? '/admin/templates?view=needs-lina' : `/admin/templates?niche=${f.niche ?? ''}&view=${view}`
    const on = f.view === view
    return (
      <Link href={href} className={on ? 'font-semibold text-[#ba3d3d]' : 'text-zinc-600 hover:text-[#ba3d3d]'}>
        {label}
      </Link>
    )
  }
  const conf = f.niche ? coverage.get(f.niche) ?? 0 : 0

  return (
    <div className="space-y-5" data-testid="admin-templates">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">Templates</h2>
        <p className="text-xs text-zinc-500">Powered by Envato API · localhost only</p>
      </div>
      {f.msg ? <p className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-sm" data-testid="templates-msg">{f.msg}</p> : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm space-y-2">
        <p>
          Last sync:{' '}
          {lastRun ? (
            <span data-testid="last-sync">
              #{lastRun.id} {new Date(lastRun.started_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT ·{' '}
              {lastRun.finished_at ? (lastRun.complete ? 'complete' : 'incomplete') : 'running'} · {lastRun.items_seen} seen ·{' '}
              {lastRun.items_changed} changed · {lastRun.items_removed} removed · {lastRun.calls} calls
              {lastRun.error ? ` · error: ${lastRun.error}` : ''}
            </span>
          ) : (
            'never'
          )}
        </p>
        <p className="text-xs text-zinc-500">Scheduled 3-hour sync is written but OFF (Gate 1). Rows not seen in {FRESH_HOURS} h are hidden.</p>
        <div className="flex flex-wrap gap-2">
          {envatoTokenConfigured() ? (
            <form action={syncNowAction}><button className="rounded bg-[#ba3d3d] px-3 py-1 text-white">Sync now</button></form>
          ) : (
            <button type="button" disabled data-testid="sync-manual-only" title="No Envato token loaded on this server. Run the manual sync command." className="rounded bg-zinc-200 px-3 py-1 text-zinc-600 cursor-not-allowed">Manual sync only</button>
          )}
          <form action={importShortlistAction}><button className="rounded border border-zinc-300 px-3 py-1">Re-import Lina&apos;s shortlist</button></form>
          <Link href="/admin/templates/widen-log" className="px-3 py-1 text-[#ba3d3d] underline">Widen log</Link>
          <Link href="/admin/templates/digest" className="px-3 py-1 text-[#ba3d3d] underline">Digest</Link>
        </div>
      </section>

      <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
        <label className="flex flex-col">Business type (required)
          <select name="niche" defaultValue={f.niche ?? ''} className="border rounded px-2 py-1" data-testid="niche-select">
            <option value="" disabled>Pick a type…</option>
            {NICHES.map((n) => <option key={n} value={n}>{NICHE_LABEL[n]} ({coverage.get(n) ?? 0} confirmed)</option>)}
          </select>
        </label>
        <input type="hidden" name="view" value={f.view === 'needs-lina' ? 'shortlist' : f.view} />
        <label className="flex flex-col">Platform
          <select name="platform" defaultValue={f.platform ?? ''} className="border rounded px-2 py-1">
            <option value="">HTML + WP</option><option value="html">HTML</option><option value="wp">WordPress</option>
          </select>
        </label>
        <label className="flex flex-col">Category
          <select name="category" defaultValue={f.category ?? ''} className="border rounded px-2 py-1">
            <option value="">Any</option>{CORE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col">Max price $<input name="maxPrice" defaultValue={f.maxPrice ?? ''} className="border rounded px-2 py-1 w-20" /></label>
        <label className="flex flex-col">Min rating<input name="minRating" defaultValue={f.minRating ?? ''} className="border rounded px-2 py-1 w-16" /></label>
        <label className="flex flex-col">Min sales<input name="minSales" defaultValue={f.minSales ?? ''} className="border rounded px-2 py-1 w-20" /></label>
        <label className="flex flex-col">Updated in (days)<input name="updatedDays" defaultValue={f.updatedDays ?? ''} className="border rounded px-2 py-1 w-16" /></label>
        <button className="rounded border border-zinc-300 px-3 py-1">Apply</button>
      </form>

      <nav className="flex gap-4 text-sm">
        {f.niche ? <>{tab('shortlist', 'Lina’s shortlist')}{tab('catalog', 'Catalog matches')}</> : null}
        {tab('needs-lina', `Needs Lina (${needsLinaCount ?? 0})`)}
      </nav>

      {f.view !== 'needs-lina' && !f.niche ? (
        <p className="text-sm text-zinc-600">Pick a business type. There is no “all templates” view.</p>
      ) : null}

      {f.niche && f.view !== 'needs-lina' ? (
        <p className={conf < MIN_PER_TYPE ? 'text-sm text-red-700' : 'text-sm text-zinc-600'} data-testid="coverage">
          {NICHE_LABEL[f.niche]}: {conf} confirmed picks{conf < MIN_PER_TYPE ? ` (under ${MIN_PER_TYPE})` : ''}
        </p>
      ) : null}

      {f.view === 'general' ? <p className="text-sm text-amber-800">Widened to general local business (logged).</p> : null}

      {f.view === 'shortlist' && f.niche ? (
        <ScrollX testId="shortlist-scroll">
        <table className="min-w-[44rem] w-full text-sm" data-testid="shortlist-table">
          <thead><tr className="text-left bg-zinc-50"><th className={`p-2 ${STICKY_FIRST_TH}`}>Template</th><th>Platform</th><th>Regular</th><th>Extended</th><th>Status</th><th>Build note</th><th>Demo</th></tr></thead>
          <tbody>
            {picks.map((p) => (
              <tr key={`${p.envato_item_id}-${p.niche}`} className="border-t align-top" data-verify={p.verify_status}>
                <td className={`p-2 max-w-[11rem] ${STICKY_FIRST_TD}`}><a href={p.url} className="text-[#ba3d3d] hover:underline" target="_blank" rel="noreferrer">{p.name}</a></td>
                <td>{p.platform}</td>
                <td data-testid="price-regular">{formatCents(p.regular_price_cents)}</td>
                <td data-testid="price-extended">{formatCents(p.extended_price_cents)}</td>
                <td>{p.verify_status}{p.verify_reason ? <span className="block text-xs text-zinc-500">{p.verify_reason}</span> : null}</td>
                <td className="text-xs">{p.build_note ?? ''}</td>
                <td>{p.demo_url ? <a href={p.demo_url} target="_blank" rel="noreferrer" className="underline">demo</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </ScrollX>
      ) : null}

      {(f.view === 'catalog' || f.view === 'general' || f.view === 'needs-lina') && (f.niche || f.view === 'needs-lina') ? (
        <ul className="space-y-2" data-testid="catalog-list">
          {items.length === 0 ? <li className="text-sm text-zinc-600">Nothing here yet{f.view !== 'needs-lina' ? ' (run a sync)' : ''}.</li> : null}
          {items.map((i) => (
            <li key={i.id} className="flex flex-col gap-3 rounded border bg-white p-2 text-sm sm:flex-row min-w-0" data-item={i.id}>
              {i.preview_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.preview_image_url} alt="" width={120} height={60} className="h-16 w-28 object-cover rounded" />
              ) : <div className="h-16 w-28 bg-zinc-100 rounded" />}
              <div className="flex-1 min-w-0 break-words">
                <a href={i.url ?? '#'} target="_blank" rel="noreferrer" className="font-medium text-[#ba3d3d] hover:underline">{i.name}</a>
                <p className="text-xs text-zinc-500">
                  {i.platform.toUpperCase()} · {i.category} · Regular {formatCents(i.price_cents)} · Extended {formatCents(i.extended_price_cents)} ·{' '}
                  {i.rating ?? '—'}★ ({i.rating_count ?? 0}) · {i.sales ?? 0} sales{i.updated_at ? ` · updated ${i.updated_at.slice(0, 10)}` : ''}
                </p>
                {f.view === 'needs-lina' ? <p className="text-xs">Matched tag: <b data-testid="matched-tag">{i.cleaning_match}</b></p> : null}
                {i.live_preview_url ? <a href={i.live_preview_url} target="_blank" rel="noreferrer" className="text-xs underline">demo</a> : null}
              </div>
              {f.view === 'needs-lina' ? (
                <div className="flex flex-row flex-wrap gap-2 sm:flex-col sm:gap-1" data-testid="cleaning-buttons">
                  {(['yes', 'no'] as const).map((d) => (
                    <form key={d} action={decideCleaningAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="decision" value={d} />
                      <input type="hidden" name="matched_tag" value={i.cleaning_match ?? ''} />
                      <button className="rounded border px-2 py-0.5 text-xs w-28">{d === 'yes' ? 'Cleaning' : 'Not cleaning'}</button>
                    </form>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {f.niche && f.view !== 'general' && f.view !== 'needs-lina' ? (
        <form action={widenAction} className="flex flex-wrap gap-2 items-end text-sm border-t pt-3">
          <input type="hidden" name="niche" value={f.niche} />
          <label className="flex flex-col flex-1">Widen to general local business. Reason (required, logged)
            <input name="reason" required className="border rounded px-2 py-1" />
          </label>
          <button className="rounded border border-zinc-300 px-3 py-1">Widen to general</button>
        </form>
      ) : null}
    </div>
  )
}
