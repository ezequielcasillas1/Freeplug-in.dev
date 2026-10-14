export type PickCardRow = {
  id: string
  business: string
  status: string
  type: string
  pick: string
  /** Show the Lock button (no lock yet). */
  canLock: boolean
  /** Show "Unlock for 1 hour" (window closed, not locked, open status). */
  canUnlock: boolean
  /** e.g. "Locked 10/13/2026, 6:39 PM" or "Customer can change (unlocked until …)". */
  note: string | null
}

const BTN = 'mt-2 flex min-h-[44px] w-full items-center justify-center rounded border border-[#ba3d3d] px-3 text-sm font-semibold text-[#ba3d3d]'

/**
 * Customer picks below `sm` (Lina, Oct 13, like ShortlistCards): business name, then one gray line with
 * status · type · pick, then full-width 44px Lock / Unlock buttons. The table stays the `sm`+ view.
 */
export function PickCards({ rows, lock, unlock }: { rows: PickCardRow[]; lock: (f: FormData) => Promise<void>; unlock: (f: FormData) => Promise<void> }) {
  return (
    <ul className="space-y-2 sm:hidden" data-testid="pick-cards">
      {rows.map((r) => (
        <li key={r.id} className="min-w-0 rounded border bg-white p-3 text-sm break-words" data-testid="pick-card">
          <p className="font-medium text-zinc-900">{r.business}</p>
          <p className="text-xs text-zinc-500" data-testid="pick-card-meta">{[r.status, r.type, r.pick].join(' · ')}</p>
          {r.note ? <p className="mt-1 text-xs text-zinc-600">{r.note}</p> : null}
          {r.canLock ? (
            <form action={lock}>
              <input type="hidden" name="request_id" value={r.id} />
              <button type="submit" className={BTN} data-testid="lock-pick-card">Lock pick</button>
            </form>
          ) : null}
          {r.canUnlock ? (
            <form action={unlock}>
              <input type="hidden" name="request_id" value={r.id} />
              <button type="submit" className={BTN} data-testid="unlock-pick-card">Unlock for 1 hour</button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
