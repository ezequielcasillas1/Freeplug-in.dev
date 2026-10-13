import { getCloudflareContext } from '@opennextjs/cloudflare'
import { after } from 'next/server'

/**
 * Run `task` after the response (Aria, round 5: forgot-password answers before the lookup and send). On
 * Cloudflare the promise is handed to ctx.waitUntil so the Worker stays alive until it settles. Elsewhere
 * (`next dev`, `next start`, vitest) there is no Workers context; the promise simply runs on its own.
 * Errors never escape: they are logged with `label`. The task must not use request-scoped APIs
 * (headers(), cookies()): read what it needs before scheduling it.
 */
export function runAfterResponse(label: string, task: () => Promise<void>): Promise<void> {
  const p = (async () => {
    try {
      await task()
    } catch (e) {
      console.error(`[${label}] background task failed:`, e instanceof Error ? e.message : e)
    }
  })()
  let waitUntil: ((p: Promise<unknown>) => void) | undefined
  try {
    const ctx = getCloudflareContext().ctx as { waitUntil?: (p: Promise<unknown>) => void } | undefined
    if (ctx && typeof ctx.waitUntil === 'function') waitUntil = ctx.waitUntil.bind(ctx)
  } catch {
    // Not running on Workers (or outside a request): local / test fallback below.
  }
  if (waitUntil) waitUntil(p)
  return p
}

/**
 * Next's `after()` (change requests, Aria Oct 4): the task runs once the response is sent; on
 * Cloudflare OpenNext hands it to ctx.waitUntil. Outside a request scope (tests, scripts) `after`
 * throws, so the task falls back to runAfterResponse. Errors never escape: they are logged.
 */
export function scheduleAfterResponse(label: string, task: () => Promise<void>): void {
  const guarded = async () => {
    try {
      await task()
    } catch (e) {
      console.error(`[${label}] background task failed:`, e instanceof Error ? e.message : e)
    }
  }
  try {
    after(guarded)
  } catch {
    void runAfterResponse(label, task)
  }
}
