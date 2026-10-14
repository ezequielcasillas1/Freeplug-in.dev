import type { PickAlarm } from './notify'

/**
 * In-memory PickAlarm with the same semantics as the Durable Object: one alarm per request, every
 * reset moves it, it fires once with the latest version. `storage` stands in for DO storage, so a new
 * MemoryPickAlarm over the same storage models a restart (DO storage + alarms are durable).
 */
export type AlarmEntry = { pickVersion: number; fireAt: number }

export class MemoryPickAlarm implements PickAlarm {
  constructor(readonly storage: Map<string, AlarmEntry> = new Map()) {}
  async reset(requestId: string, pickVersion: number, fireAt: Date) {
    this.storage.set(requestId, { pickVersion, fireAt: fireAt.getTime() })
  }
  async cancel(requestId: string) {
    this.storage.delete(requestId)
  }
  /** Alarms due at `now`, removed as they are taken (like a DO alarm firing). */
  takeDue(now: Date, force = false): { requestId: string; pickVersion: number }[] {
    const out: { requestId: string; pickVersion: number }[] = []
    for (const [requestId, a] of this.storage) {
      if (force || a.fireAt <= now.getTime()) {
        this.storage.delete(requestId)
        out.push({ requestId, pickVersion: a.pickVersion })
      }
    }
    return out
  }
  pending(): { requestId: string; pickVersion: number; fireAt: string }[] {
    return [...this.storage].map(([requestId, a]) => ({ requestId, pickVersion: a.pickVersion, fireAt: new Date(a.fireAt).toISOString() }))
  }
}
