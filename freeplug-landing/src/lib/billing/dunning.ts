/**
 * Failed hosting payment policy (Cheke, Oct 23 2026). Day 0 = the first failed hosting charge (e.g. the new
 * $35 after a $100 -> $35 downgrade, or any monthly renewal):
 *   day 0-13  grace     : NOT past due. Site stays up. Gentle "pay now" notice.
 *   day 14-16 past_due  : marked past due. Site stays up. Stronger notice.
 *   day 17+   paused    : site paused (not deleted). No site access until the hosting fee is paid.
 * The site stays STORED while paused, at least until the client's yearly domain (Namecheap) registration
 * expires; after that it is flagged for the owner to decide (`domainExpired`). Nothing here ever deletes.
 * Paying at any time (invoice.paid) closes the case and restores access.
 *
 * Pure + injected clock. The webhook opens/closes cases; runDunningCheck() is the cron (daily is enough).
 * No emails are sent from here: transitions go to an injected onTransition (log only for now).
 */
export const GRACE_DAYS = 14
export const PAUSE_DAY = 17
const DAY_MS = 86_400_000

export type DunningState = 'grace' | 'past_due' | 'paused'
export type DunningCase = {
  subscription_id: string
  profile_id: string
  first_failed_at: string
  /** Set when paid: the case is closed. */
  resolved_at: string | null
  state: DunningState
  /** Yearly domain registration expiry (Namecheap), when known. */
  domain_expires_at: string | null
  paused_at: string | null
}

export type DunningView = {
  state: DunningState
  /** Whole days since the first failure (0 on the day it failed). */
  day: number
  /** Days left before it is marked past due (grace) / before the pause (past_due); 0 when paused. */
  daysLeft: number
  pastDueAt: Date
  pauseAt: Date
  siteAccess: boolean
  /** Paused AND the domain registration has expired: owner decides (still never auto-deleted). */
  domainExpired: boolean
}

export function dunningView(c: Pick<DunningCase, 'first_failed_at' | 'domain_expires_at'>, now: Date): DunningView {
  const start = Date.parse(c.first_failed_at)
  const day = Math.max(0, Math.floor((now.getTime() - start) / DAY_MS))
  const pastDueAt = new Date(start + GRACE_DAYS * DAY_MS)
  const pauseAt = new Date(start + PAUSE_DAY * DAY_MS)
  const state: DunningState = day >= PAUSE_DAY ? 'paused' : day >= GRACE_DAYS ? 'past_due' : 'grace'
  const daysLeft = state === 'grace' ? GRACE_DAYS - day : state === 'past_due' ? PAUSE_DAY - day : 0
  const domainExpired = state === 'paused' && c.domain_expires_at != null && Date.parse(c.domain_expires_at) <= now.getTime()
  return { state, day, daysLeft, pastDueAt, pauseAt, siteAccess: state !== 'paused', domainExpired }
}

export interface DunningStore {
  /** Open (unresolved) case for a subscription, or null. */
  open(subscriptionId: string): Promise<DunningCase | null>
  allOpen(): Promise<DunningCase[]>
  insert(c: DunningCase): Promise<void>
  update(subscriptionId: string, patch: Partial<Pick<DunningCase, 'state' | 'paused_at' | 'resolved_at' | 'domain_expires_at'>>): Promise<void>
}

/** invoice.payment_failed on a hosting subscription: opens a case once; a second failure keeps the original day 0. */
export async function openDunning(store: DunningStore, o: { subscriptionId: string; profileId: string; failedAt: Date; domainExpiresAt?: Date | null }): Promise<'opened' | 'already_open'> {
  if (await store.open(o.subscriptionId)) return 'already_open'
  await store.insert({
    subscription_id: o.subscriptionId,
    profile_id: o.profileId,
    first_failed_at: o.failedAt.toISOString(),
    resolved_at: null,
    state: 'grace',
    domain_expires_at: o.domainExpiresAt ? o.domainExpiresAt.toISOString() : null,
    paused_at: null,
  })
  return 'opened'
}

/** invoice.paid: closes the open case (any day, also while paused) = access back. */
export async function resolveDunning(store: DunningStore, subscriptionId: string, paidAt: Date): Promise<'resolved' | 'none'> {
  const c = await store.open(subscriptionId)
  if (!c) return 'none'
  await store.update(subscriptionId, { resolved_at: paidAt.toISOString() })
  return 'resolved'
}

export type DunningTransition = { subscriptionId: string; profileId: string; from: DunningState; to: DunningState; day: number; domainExpired: boolean }

/** Cron: moves each open case to its state for `now`. Only state/paused_at change; never deletes. Idempotent. */
export async function runDunningCheck(deps: {
  store: DunningStore
  now: () => Date
  onTransition?: (t: DunningTransition) => Promise<unknown> | unknown
  /**
   * Fresh check (Stripe) before moving a case forward: false = actually paid (a missed invoice.paid), so the
   * case is closed instead. Errors keep the current state (never pause on a failed lookup).
   */
  stillUnpaid?: (subscriptionId: string) => Promise<boolean>
}): Promise<{ checked: number; transitions: DunningTransition[]; domainExpired: string[]; resolved: string[] }> {
  const now = deps.now()
  const transitions: DunningTransition[] = []
  const domainExpired: string[] = []
  const resolved: string[] = []
  const open = await deps.store.allOpen()
  for (const c of open) {
    const v = dunningView(c, now)
    if (v.domainExpired) domainExpired.push(c.subscription_id)
    if (v.state === c.state) continue
    if (deps.stillUnpaid) {
      let unpaid: boolean
      try {
        unpaid = await deps.stillUnpaid(c.subscription_id)
      } catch (e) {
        console.error('[dunning] stillUnpaid lookup failed; state kept', c.subscription_id, e instanceof Error ? e.message : e)
        continue
      }
      if (!unpaid) {
        await deps.store.update(c.subscription_id, { resolved_at: now.toISOString() })
        resolved.push(c.subscription_id)
        continue
      }
    }
    await deps.store.update(c.subscription_id, { state: v.state, ...(v.state === 'paused' && !c.paused_at ? { paused_at: now.toISOString() } : {}) })
    const t = { subscriptionId: c.subscription_id, profileId: c.profile_id, from: c.state, to: v.state, day: v.day, domainExpired: v.domainExpired }
    transitions.push(t)
    try {
      await deps.onTransition?.(t)
    } catch (e) {
      console.error('[dunning] onTransition failed', e instanceof Error ? e.message : e)
    }
  }
  return { checked: open.length, transitions, domainExpired, resolved }
}

export function memoryDunningStore(rows: DunningCase[] = []): DunningStore & { rows: DunningCase[] } {
  return {
    rows,
    async open(id) {
      return rows.find((r) => r.subscription_id === id && !r.resolved_at) ?? null
    },
    async allOpen() {
      return rows.filter((r) => !r.resolved_at).map((r) => ({ ...r }))
    },
    async insert(c) {
      rows.push({ ...c })
    },
    async update(id, patch) {
      const r = rows.find((x) => x.subscription_id === id && !x.resolved_at)
      if (r) Object.assign(r, patch)
    },
  }
}

type Db = { from(t: string): any } // eslint-disable-line @typescript-eslint/no-explicit-any
const COLS = 'subscription_id, profile_id, first_failed_at, resolved_at, state, domain_expires_at, paused_at'
/** hosting_dunning (migration 20261023130000), service role. */
export function supabaseDunningStore(db: Db): DunningStore {
  const fail = (e: { message: string } | null) => {
    if (e) throw new Error(`hosting_dunning: ${e.message}`)
  }
  return {
    async open(id) {
      const { data, error } = await db.from('hosting_dunning').select(COLS).eq('subscription_id', id).is('resolved_at', null).maybeSingle()
      fail(error)
      return (data as DunningCase | null) ?? null
    },
    async allOpen() {
      const { data, error } = await db.from('hosting_dunning').select(COLS).is('resolved_at', null).limit(1000)
      fail(error)
      return (data ?? []) as DunningCase[]
    },
    async insert(c) {
      const { error } = await db.from('hosting_dunning').insert(c)
      // 23505 = another delivery opened it first (one open case per subscription): fine.
      if (error && (error as { code?: string }).code !== '23505') fail(error)
    },
    async update(id, patch) {
      const { error } = await db.from('hosting_dunning').update({ ...patch, updated_at: new Date().toISOString() }).eq('subscription_id', id).is('resolved_at', null)
      fail(error)
    },
  }
}
