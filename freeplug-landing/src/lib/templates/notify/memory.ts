import type { Candidate, ShortlistRow, Suggestion } from './score'
import type { ItemDetails, NotifyDeps, OutMail, QueueRow, RequestContext, SendResult } from './notify'

/** In-memory NotifyDeps (tests and the sample generator). Same queue rules as the SQL table. */
export type MemoryState = {
  clock: { now: Date }
  requests: Map<string, RequestContext & { version: number; suggestions?: unknown }>
  items: Map<number, ItemDetails>
  shortlist: ShortlistRow[]
  queue: (QueueRow & { sentAt: string | null; lastError: string | null })[]
  sent: OutMail[]
  alerts: string[]
  failSend: boolean
}

export function memoryNotify(init?: Partial<Pick<MemoryState, 'shortlist'>> & { items?: ItemDetails[]; now?: Date }): { deps: NotifyDeps; state: MemoryState } {
  const state: MemoryState = {
    clock: { now: init?.now ?? new Date('2026-10-14T15:00:00Z') },
    requests: new Map(),
    items: new Map((init?.items ?? []).map((i) => [i.id, i])),
    shortlist: init?.shortlist ?? [],
    queue: [],
    sent: [],
    alerts: [],
    failSend: false,
  }
  let seq = 0
  const keys = new Set<string>()
  const deps: NotifyDeps = {
    now: () => new Date(state.clock.now),
    bumpVersion: async (id) => {
      const r = state.requests.get(id)
      if (!r) throw new Error('no request')
      return ++r.version
    },
    loadContext: async (id) => {
      const r = state.requests.get(id)
      return r ? { ...r } : null
    },
    lookupItem: async (id) => state.items.get(id) ?? null,
    hasPickedEvent: async (id) => state.queue.some((q) => q.requestId === id && q.event === 'picked'),
    enqueue: async (row) => {
      if (state.queue.some((q) => q.requestId === row.requestId && q.event === row.event && q.pickVersion === row.pickVersion)) return
      state.queue.push({ ...row, id: ++seq, attempts: 0, sentAt: null, lastError: null })
    },
    upsertPendingChange: async (requestId, pickVersion, dueAt) => {
      const p = state.queue.find((q) => q.requestId === requestId && q.event === 'changed' && !q.sentAt)
      if (p) Object.assign(p, { pickVersion, dueAt })
      else state.queue.push({ id: ++seq, requestId, event: 'changed', pickVersion, dueAt, attempts: 0, sentAt: null, lastError: null })
    },
    cancelPendingChange: async (requestId) => {
      for (const q of state.queue) if (q.requestId === requestId && q.event === 'changed' && !q.sentAt) {
        q.sentAt = state.clock.now.toISOString()
        q.lastError = 'superseded by team_pick'
      }
    },
    listDue: async (now) => state.queue.filter((q) => !q.sentAt && Date.parse(q.dueAt) <= now.getTime()).map((q) => ({ ...q })),
    markSent: async (id, at) => {
      const q = state.queue.find((x) => x.id === id)
      if (q) q.sentAt = at.toISOString()
    },
    markFailed: async (id, error) => {
      const q = state.queue.find((x) => x.id === id)
      if (q) { q.attempts++; q.lastError = error }
    },
    listCandidates: async () => [...state.items.values()] as Candidate[],
    listShortlist: async (type) => state.shortlist.filter((s) => s.niche === type),
    saveSuggestions: async (id, s: { version: number; at: string; suggestions: Suggestion[] }) => {
      const r = state.requests.get(id)
      if (r) r.suggestions = s
    },
    send: async (m): Promise<SendResult> => {
      if (state.failSend) return { ok: false, error: 'simulated Resend outage' }
      if (keys.has(m.idempotencyKey)) return { ok: true, id: 'dup' }
      keys.add(m.idempotencyKey)
      state.sent.push(m)
      return { ok: true, id: `mem-${state.sent.length}` }
    },
    alert: async (msg) => { state.alerts.push(msg) },
    adminTo: () => 'admin@example.test',
  }
  return { deps, state }
}
