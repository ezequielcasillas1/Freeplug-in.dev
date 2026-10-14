import { getCloudflareContext } from '@opennextjs/cloudflare'
import { MemoryPickAlarm } from './alarm-memory'
import type { PickAlarm } from './notify'

/**
 * Picks the PickAlarm for this runtime:
 *   Cloudflare (binding PICK_NOTIFY_ALARM present): the Durable Object in do.ts, one per request id.
 *   Anywhere else (next dev, scripts): one in-process MemoryPickAlarm plus a dev timer that fires due
 *   alarms every 15 s, and the dev-only "Fire alarm now" button on /admin/notify-outbox.
 */
type DoNamespace = {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(url: string, init?: RequestInit): Promise<Response> }
}

export class DurableObjectPickAlarm implements PickAlarm {
  constructor(private ns: DoNamespace) {}
  private async call(requestId: string, body: Record<string, unknown>) {
    const res = await this.ns.get(this.ns.idFromName(requestId)).fetch('https://pick-notify-alarm/', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId, ...body }),
    })
    if (!res.ok) throw new Error(`pick alarm ${body.op} failed (${res.status})`)
  }
  reset(requestId: string, pickVersion: number, fireAt: Date) {
    return this.call(requestId, { op: 'reset', pickVersion, fireAt: fireAt.getTime() })
  }
  cancel(requestId: string) {
    return this.call(requestId, { op: 'cancel' })
  }
}

const g = globalThis as unknown as { __pickAlarmDev?: MemoryPickAlarm; __pickAlarmTimer?: ReturnType<typeof setInterval> }

export function devAlarm(): MemoryPickAlarm {
  if (!g.__pickAlarmDev) g.__pickAlarmDev = new MemoryPickAlarm()
  if (!g.__pickAlarmTimer && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    g.__pickAlarmTimer = setInterval(() => void fireDevAlarms(false), 15_000)
    g.__pickAlarmTimer.unref?.()
  }
  return g.__pickAlarmDev
}

/** Fire due (or, with force, all) dev alarms. Dev/local only. */
export async function fireDevAlarms(force: boolean): Promise<number> {
  const { notifyDeps } = await import('./server-core')
  const { fireChangeAlarm } = await import('./notify')
  const deps = notifyDeps()
  const due = devAlarm().takeDue(await deps.now(), force)
  for (const a of due) await fireChangeAlarm(deps, a.requestId, a.pickVersion)
  return due.length
}

export function getAlarm(): PickAlarm {
  try {
    const env = getCloudflareContext().env as { PICK_NOTIFY_ALARM?: DoNamespace }
    if (env?.PICK_NOTIFY_ALARM) return new DurableObjectPickAlarm(env.PICK_NOTIFY_ALARM)
  } catch {
    // not on Workers
  }
  return devAlarm()
}
