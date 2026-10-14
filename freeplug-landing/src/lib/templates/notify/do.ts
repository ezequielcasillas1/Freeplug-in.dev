import { fireChangeAlarm, type NotifyDeps } from './notify'

/**
 * Durable Object: one instance per website request (idFromName(requestId)). Holds the debounce alarm
 * for the 'changed' email. POST {op:'reset', pickVersion, fireAt} stores the latest version and moves
 * the alarm (setAlarm replaces any earlier one); POST {op:'cancel'} clears both. alarm() sends ONE
 * 'changed' email with the request's latest state, keyed request + 'changed' + latest version.
 * Storage and alarms are durable: a Worker restart, deploy, or eviction doesn't lose a pending alarm,
 * and Cloudflare retries alarm() if it throws. CODE ONLY: binding PICK_NOTIFY_ALARM in wrangler.jsonc,
 * exported from custom-worker.ts; nothing is deployed.
 */
type DoStorage = {
  get<T>(key: string): Promise<T | undefined>
  put(key: string, v: unknown): Promise<void>
  delete(key: string): Promise<boolean>
  setAlarm(t: number): Promise<void>
  deleteAlarm(): Promise<void>
}
export type DoState = { storage: DoStorage }
type Pending = { requestId: string; pickVersion: number }

export class PickNotifyAlarm {
  constructor(
    private state: DoState,
    _env?: unknown,
    private makeDeps: () => Promise<NotifyDeps> = async () => (await import('./server-core')).notifyDeps(),
  ) {}

  async fetch(req: Request): Promise<Response> {
    if (req.method !== 'POST') return new Response('method', { status: 405 })
    let b: { op?: string; requestId?: string; pickVersion?: number; fireAt?: number }
    try { b = await req.json() } catch { return new Response('bad json', { status: 400 }) }
    if (typeof b.requestId !== 'string' || !b.requestId) return new Response('bad request', { status: 400 })
    if (b.op === 'cancel') {
      await this.state.storage.deleteAlarm()
      await this.state.storage.delete('pending')
      return new Response('ok')
    }
    if (b.op === 'reset' && Number.isSafeInteger(b.pickVersion) && Number.isFinite(b.fireAt)) {
      await this.state.storage.put('pending', { requestId: b.requestId, pickVersion: b.pickVersion! } satisfies Pending)
      await this.state.storage.setAlarm(b.fireAt!)
      return new Response('ok')
    }
    return new Response('bad op', { status: 400 })
  }

  async alarm(): Promise<void> {
    const p = await this.state.storage.get<Pending>('pending')
    if (!p) return
    await fireChangeAlarm(await this.makeDeps(), p.requestId, p.pickVersion)
    // A failed send is in the notify log (manual Resend); clear so it doesn't loop.
    await this.state.storage.delete('pending')
  }
}
