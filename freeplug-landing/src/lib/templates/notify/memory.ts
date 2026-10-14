import { MemoryPickAlarm } from './alarm-memory'
import type { Candidate, ShortlistRow, Suggestion } from './score'
import type { ItemDetails, LogRow, NotifyDeps, OutMail, RequestContext, SendResult } from './notify'

/** In-memory NotifyDeps (tests and the sample generator). Same rules as the SQL log + the DO alarm. */
export type MemoryState = {
  clock: { now: Date }
  requests: Map<string, RequestContext & { version: number; suggestions?: unknown }>
  items: Map<number, ItemDetails>
  shortlist: ShortlistRow[]
  log: LogRow[]
  sent: OutMail[]
  errors: string[]
  failSend: boolean
}

export function memoryNotify(init?: { shortlist?: ShortlistRow[]; items?: ItemDetails[]; now?: Date; alarm?: MemoryPickAlarm }): { deps: NotifyDeps; state: MemoryState; alarm: MemoryPickAlarm } {
  const state: MemoryState = {
    clock: { now: init?.now ?? new Date('2026-10-14T15:00:00Z') },
    requests: new Map(),
    items: new Map((init?.items ?? []).map((i) => [i.id, i])),
    shortlist: init?.shortlist ?? [],
    log: [],
    sent: [],
    errors: [],
    failSend: false,
  }
  const alarm = init?.alarm ?? new MemoryPickAlarm()
  let seq = 0
  const keys = new Set<string>()
  const find = (r: string, e: string, v: number) => state.log.find((l) => l.requestId === r && l.event === e && l.pickVersion === v)
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
    alarm,
    log: {
      wasSent: async (r, e, v) => !!find(r, e, v)?.sentAt,
      hasPicked: async (r) => state.log.some((l) => l.requestId === r && l.event === 'picked'),
      record: async ({ requestId, event, pickVersion, ok, error, at }) => {
        let row = find(requestId, event, pickVersion)
        if (!row) {
          row = { id: ++seq, requestId, event, pickVersion, sentAt: null, attempts: 0, lastError: null, updatedAt: at.toISOString() }
          state.log.push(row)
        }
        if (ok) Object.assign(row, { sentAt: at.toISOString(), lastError: null })
        else Object.assign(row, { attempts: row.attempts + 1, lastError: error ?? 'failed' })
        row.updatedAt = at.toISOString()
      },
      listFailed: async () => state.log.filter((l) => !l.sentAt),
      get: async (id) => state.log.find((l) => l.id === id) ?? null,
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
    adminTo: () => 'admin@example.test',
    logError: (m) => { state.errors.push(m) },
  }
  return { deps, state, alarm }
}
