import { formatCents } from './view'

export type ShortlistCardPick = {
  envato_item_id: number
  niche: string
  name: string
  url: string
  platform: string | null
  verify_status: string
  verify_reason: string | null
  regular_price_cents: number | null
  extended_price_cents: number | null
}

/**
 * Shortlist below `sm` (Lina's fix, Oct 13): one stacked card per pick, like the Needs Lina list.
 * Name, then platform + prices on one gray line (the table's column labels as inline labels), then
 * Status. The full table (with Build note and Demo) stays the `sm`+ view, unchanged at 1280.
 */
export function ShortlistCards({ picks }: { picks: ShortlistCardPick[] }) {
  return (
    <ul className="space-y-2 sm:hidden" data-testid="shortlist-cards">
      {picks.map((p) => (
        <li key={`${p.envato_item_id}-${p.niche}`} className="rounded border bg-white p-2 text-sm min-w-0 break-words" data-verify={p.verify_status}>
          <a href={p.url} className="font-medium text-[#ba3d3d] hover:underline" target="_blank" rel="noreferrer">{p.name}</a>
          <p className="text-xs text-zinc-500" data-testid="card-meta">
            {p.platform ?? '—'} · Regular {formatCents(p.regular_price_cents)} · Extended {formatCents(p.extended_price_cents)}
          </p>
          <p className="text-xs" data-testid="card-status">
            Status: <b>{p.verify_status}</b>
            {p.verify_reason ? <span className="block text-zinc-500">{p.verify_reason}</span> : null}
          </p>
        </li>
      ))}
    </ul>
  )
}
