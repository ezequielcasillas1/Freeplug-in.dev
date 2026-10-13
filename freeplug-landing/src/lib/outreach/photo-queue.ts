import { ERROR_TOO_LARGE, PHOTO_REFUSED } from './copy'
import { checkPhotoFile } from './client-image'
import { PHOTO_LIMITS } from './limits'

/**
 * Browser-side photo rules (Vera / Lina / Sable, Sep 27 12:05 AM), kept free of React so they
 * can be tested:
 *   * refused BEFORE upload, with no server call and no count toward the 50: a type we don't
 *     take, a file the browser can't decode or convert (e.g. HEIC in Chrome on Windows/Android),
 *     or a photo still over 5 MB after shrinking (Sable's PHOTO_REFUSED). An original over 10 MB
 *     gets Sable's too-large line. Refused photos never get a thumbnail;
 *   * each accepted photo gets a UUID (idempotency key) so a retry never counts twice;
 *   * uploads retry by themselves ("Upload paused. Trying again…") before showing
 *     "Tap to try again"; failed photos go to the front of the grid.
 */
export type PreparedPhoto = { kind: 'ready'; blob: Blob } | { kind: 'refused'; message: string }

export async function preparePicked(
  file: { name: string; type: string; size: number } & Blob,
  prepare: (file: File) => Promise<Blob>
): Promise<PreparedPhoto> {
  const check = checkPhotoFile(file)
  if (check === 'too_large') return { kind: 'refused', message: ERROR_TOO_LARGE }
  if (check === 'bad_type') return { kind: 'refused', message: PHOTO_REFUSED }
  let blob: Blob
  try {
    blob = await prepare(file as File)
  } catch {
    return { kind: 'refused', message: PHOTO_REFUSED }
  }
  if (!blob || blob.size === 0 || blob.size > PHOTO_LIMITS.maxUploadBytes) return { kind: 'refused', message: PHOTO_REFUSED }
  return { kind: 'ready', blob }
}

/** Free slots left on this link (photos already sent from it plus the ones waiting here). */
export function remainingSlots(alreadySent: number, waiting: number, max: number = PHOTO_LIMITS.maxPerLink): number {
  return Math.max(0, max - alreadySent - waiting)
}

export type UploadResult = { ok: true; photoId?: string } | { ok: false; code?: string; error?: string }

/** Server answers that retrying the same bytes can't fix. */
export const NON_RETRYABLE_CODES = new Set(['photo_limit', 'expired', 'bad_type', 'too_large', 'unreadable', 'invalid', 'rate'])

export const AUTO_RETRY_DELAYS_MS = [1500, 4000] as const

/**
 * One photo upload with automatic retries. `upload` must send the same idempotency key each time,
 * so a try whose answer was lost doesn't add a second photo.
 */
export async function uploadWithRetry(
  upload: () => Promise<UploadResult>,
  opts: { onRetrying?: (attempt: number) => void; delays?: readonly number[]; sleep?: (ms: number) => Promise<void> } = {}
): Promise<UploadResult> {
  const delays = opts.delays ?? AUTO_RETRY_DELAYS_MS
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let last: UploadResult = { ok: false, code: 'upload' }
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) {
      opts.onRetrying?.(attempt)
      await sleep(delays[attempt - 1])
    }
    try {
      last = await upload()
    } catch {
      last = { ok: false, code: 'network' }
    }
    if (last.ok) return last
    if (last.code && NON_RETRYABLE_CODES.has(last.code)) return last
  }
  return last
}

/** Failed photos first (never hidden behind "Show all"), otherwise the order they were picked. */
export function orderForGrid<T extends { status: string }>(photos: readonly T[]): T[] {
  return [...photos.filter((p) => p.status === 'failed'), ...photos.filter((p) => p.status !== 'failed')]
}

/** Two rows collapsed: 3 across on phone, 5 on desktop. */
export const COLLAPSED_PHONE = 6
export const COLLAPSED_DESKTOP = 10

export function newClientPhotoId(): string {
  return crypto.randomUUID()
}
