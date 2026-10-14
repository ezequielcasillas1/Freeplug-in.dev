/**
 * Template pick window (Aria ruling, Oct 13; Cheke 8:24 PM).
 *
 * The customer is told "1 hour" and the countdown runs to the 60-minute mark. The server, the DB trigger
 * (supabase/migrations/20261013200000_template_pick_window.sql) and the admin "Unlock" use 65 minutes,
 * a silent 5-minute grace. From 60 to 65 the countdown is hidden while the picker keeps working; the
 * page only goes read-only when the server says the window is closed.
 *
 * The window starts at the FIRST pick (template_first_picked_at, set once); a re-pick never extends it.
 * An admin unlock (template_unlocked_until) reopens it until that time. Older picks are backfilled
 * (first_picked_at = picked_at, 20261013210000) and so locked; a pick with a NULL first_picked_at is locked too. template_locked_at always wins.
 */
export const PICK_WINDOW_DISPLAY_MIN = 60
/** Must match interval '65 minutes' in the migration (template-pick-window-migration.test.ts checks it). */
export const PICK_WINDOW_SERVER_MIN = 65

const MIN_MS = 60_000

export type PickWindowRow = {
  status: string
  template_locked_at: string | null
  template_first_picked_at?: string | null
  template_unlocked_until?: string | null
  template_choice?: string | null
}

function ms(ts: string | null | undefined): number | null {
  if (ts == null) return null
  const t = Date.parse(ts)
  return Number.isFinite(t) ? t : null
}

function unlockedAt(r: PickWindowRow, nowMs: number): boolean {
  const u = ms(r.template_unlocked_until)
  return u != null && nowMs < u
}

/** Server rule, same as public.template_pick_window_open() in SQL. */
export function isPickWindowOpen(r: PickWindowRow, now: Date): boolean {
  if (!(r.status === 'submitted' || r.status === 'in_review') || r.template_locked_at != null) return false
  const nowMs = now.getTime()
  const first = ms(r.template_first_picked_at)
  if (unlockedAt(r, nowMs)) return true
  // Aria ruling 1 (Oct 13, 8:44 PM): a pick with no first-pick time (pre-window row) counts as locked;
  // admin Unlock is the way out. No pick yet = the window hasn't started.
  if (first == null) return r.template_choice == null
  return nowMs < first + PICK_WINDOW_SERVER_MIN * MIN_MS
}

/** Ms until the countdown ends (60-minute mark, or an unlock's end minus the grace); null when hidden. */
export function pickCountdownMs(r: PickWindowRow, now: Date): number | null {
  if (!isPickWindowOpen(r, now)) return null
  const first = ms(r.template_first_picked_at)
  if (first == null) return null
  const nowMs = now.getTime()
  const graceMs = (PICK_WINDOW_SERVER_MIN - PICK_WINDOW_DISPLAY_MIN) * MIN_MS
  const ends = [first + PICK_WINDOW_DISPLAY_MIN * MIN_MS]
  const u = ms(r.template_unlocked_until)
  if (u != null && nowMs < u) ends.push(u - graceMs)
  const left = Math.max(...ends) - nowMs
  return left > 0 ? left : null
}

/**
 * Whole minutes left for the customer countdown, rounded UP (never 0), or null when no countdown shows:
 * no pick yet, window closed, or past the 60-minute display mark (grace period). During an admin unlock
 * the countdown runs to unlocked_until minus the same 5-minute grace.
 */
export function pickCountdownMinutes(r: PickWindowRow, now: Date): number | null {
  const left = pickCountdownMs(r, now)
  return left == null ? null : Math.ceil(left / MIN_MS)
}

/** Admin unlock end, from the DB clock. */
export function unlockUntil(now: Date): Date {
  return new Date(now.getTime() + PICK_WINDOW_SERVER_MIN * MIN_MS)
}
