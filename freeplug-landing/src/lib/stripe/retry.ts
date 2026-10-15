// Retry with backoff (L-1, Aria Oct 4 9:57). Own file: change-plan.ts and addon-removal-owed.ts both use it.

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** 3 tries: the first, then after 0.5 s, then after 1.5 s. */
export const REMOVAL_RESCHEDULE_TRIES = 3
export const REMOVAL_RESCHEDULE_BACKOFF_MS: readonly number[] = [500, 1500]

/** Runs `fn` up to `tries` times with the backoff between tries; throws the last error. */
export async function withRetries<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { tries?: number; backoffMs?: readonly number[]; sleep?: (ms: number) => Promise<void>; onFail?: (attempt: number, e: unknown) => void } = {}
): Promise<T> {
  const tries = opts.tries ?? REMOVAL_RESCHEDULE_TRIES
  const backoff = opts.backoffMs ?? REMOVAL_RESCHEDULE_BACKOFF_MS
  const sleep = opts.sleep ?? defaultSleep
  let last: unknown
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn(attempt)
    } catch (e) {
      last = e
      opts.onFail?.(attempt, e)
      if (attempt < tries) await sleep(backoff[Math.min(attempt - 1, backoff.length - 1)] ?? 0)
    }
  }
  throw last
}

