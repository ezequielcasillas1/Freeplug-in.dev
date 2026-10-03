import { PHOTO_LIMITS } from './limits'

/**
 * Runs `worker` over `items` with at most `concurrency` in flight (photo uploads: 3 at a time).
 * A failing item never stops the others; the caller marks it failed and can retry it alone.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  concurrency: number = PHOTO_LIMITS.uploadConcurrency
): Promise<void> {
  let next = 0
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      try {
        await worker(item)
      } catch {
        // the worker reports its own failure state
      }
    }
  })
  await Promise.all(lanes)
}
