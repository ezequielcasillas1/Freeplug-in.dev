// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ERROR_TOO_LARGE, PHOTO_REFUSED } from './copy'
import { PHOTO_LIMITS } from './limits'
import { orderForGrid, preparePicked, remainingSlots, uploadWithRetry, type UploadResult } from './photo-queue'
import { runWithConcurrency } from './upload-queue'

const MB = 1024 * 1024
function file(name: string, type: string, size: number) {
  // Only name/type/size matter before conversion; a plain object stands in for the File.
  return { name, type, size } as unknown as File
}

describe('pre-upload refusals (no server call, no count toward the 50)', () => {
  it('refuses a type we do not take without even trying to convert it', async () => {
    let prepared = 0
    const prepare = async () => {
      prepared++
      return new Blob(['x'])
    }
    for (const f of [file('a.gif', 'image/gif', 1000), file('b.svg', 'image/svg+xml', 1000), file('c.txt', 'text/plain', 10)]) {
      expect(await preparePicked(f, prepare)).toEqual({ kind: 'refused', message: PHOTO_REFUSED })
    }
    expect(prepared).toBe(0)
  })

  it('refuses a file the browser cannot decode or convert (e.g. HEIC in Chrome on Windows)', async () => {
    const cannotDecode = async (): Promise<Blob> => {
      throw new Error('decode')
    }
    expect(await preparePicked(file('IMG_1.HEIC', 'image/heic', 3 * MB), cannotDecode)).toEqual({ kind: 'refused', message: PHOTO_REFUSED })
    expect(await preparePicked(file('IMG_2.heic', '', 3 * MB), cannotDecode)).toEqual({ kind: 'refused', message: PHOTO_REFUSED })
  })

  it('refuses a photo that is still over 5 MB after shrinking', async () => {
    const tooBig = async () => ({ size: PHOTO_LIMITS.maxUploadBytes + 1 }) as Blob
    expect(await preparePicked(file('big.png', 'image/png', 9 * MB), tooBig)).toEqual({ kind: 'refused', message: PHOTO_REFUSED })
    const empty = async () => ({ size: 0 }) as Blob
    expect(await preparePicked(file('zero.jpg', 'image/jpeg', 100), empty)).toEqual({ kind: 'refused', message: PHOTO_REFUSED })
  })

  it('refuses an original over 10 MB with the too-large line', async () => {
    let prepared = 0
    const prepare = async () => {
      prepared++
      return new Blob(['x'])
    }
    expect(await preparePicked(file('huge.jpg', 'image/jpeg', 10 * MB + 1), prepare)).toEqual({ kind: 'refused', message: ERROR_TOO_LARGE })
    expect(prepared).toBe(0)
  })

  it('accepts a normal photo, including exactly 10 MB picked and exactly 5 MB after shrinking', async () => {
    const out = await preparePicked(file('ok.jpg', 'image/jpeg', 10 * MB), async () => ({ size: 5 * MB }) as Blob)
    expect(out.kind).toBe('ready')
  })
})

describe('remainingSlots', () => {
  it('counts photos already sent from the link plus the ones waiting here', () => {
    expect(remainingSlots(0, 0)).toBe(50)
    expect(remainingSlots(30, 15)).toBe(5)
    expect(remainingSlots(49, 1)).toBe(0)
    expect(remainingSlots(60, 0)).toBe(0)
  })
})

describe('uploadWithRetry', () => {
  const noSleep = async () => {}

  it('retries twice with the same idempotency key, then succeeds', async () => {
    const keys: string[] = []
    const answers: UploadResult[] = [{ ok: false, code: 'upload' }, { ok: false, code: 'network' }, { ok: true, photoId: 'p1' }]
    const retrying: number[] = []
    const res = await uploadWithRetry(
      async () => {
        keys.push('client-uuid-1')
        return answers.shift()!
      },
      { sleep: noSleep, onRetrying: (n) => retrying.push(n) }
    )
    expect(res).toEqual({ ok: true, photoId: 'p1' })
    expect(keys).toEqual(['client-uuid-1', 'client-uuid-1', 'client-uuid-1'])
    expect(retrying).toEqual([1, 2])
  })

  it('treats a thrown error (lost connection) as retryable and gives up after 3 tries', async () => {
    let calls = 0
    const res = await uploadWithRetry(
      async (): Promise<UploadResult> => {
        calls++
        throw new Error('offline')
      },
      { sleep: noSleep }
    )
    expect(res).toEqual({ ok: false, code: 'network' })
    expect(calls).toBe(3)
  })

  it('stops at once on answers a retry cannot fix', async () => {
    for (const code of ['photo_limit', 'bad_type', 'too_large', 'expired', 'rate']) {
      let calls = 0
      const res = await uploadWithRetry(
        async () => {
          calls++
          return { ok: false, code }
        },
        { sleep: noSleep }
      )
      expect(res).toEqual({ ok: false, code })
      expect(calls).toBe(1)
    }
  })

  it('waits 1.5 s then 4 s between tries by default', async () => {
    const waits: number[] = []
    await uploadWithRetry(async () => ({ ok: false, code: 'upload' }), { sleep: async (ms) => void waits.push(ms) })
    expect(waits).toEqual([1500, 4000])
  })
})

describe('grid order and concurrency', () => {
  it('moves failed photos to the front and keeps the picked order otherwise', () => {
    const photos = [
      { id: 'a', status: 'done' },
      { id: 'b', status: 'failed' },
      { id: 'c', status: 'uploading' },
      { id: 'd', status: 'failed' },
    ]
    expect(orderForGrid(photos).map((p) => p.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('uploads at most 3 at a time and keeps going after a failure', async () => {
    let inFlight = 0
    let peak = 0
    const done: number[] = []
    await runWithConcurrency(
      Array.from({ length: 10 }, (_, i) => i),
      async (i) => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
        if (i === 4) throw new Error('fail one')
        done.push(i)
      }
    )
    expect(peak).toBe(3)
    expect(done.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 5, 6, 7, 8, 9])
  })
})
