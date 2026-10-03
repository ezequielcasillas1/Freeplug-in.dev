import { getCloudflareContext } from '@opennextjs/cloudflare'

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
