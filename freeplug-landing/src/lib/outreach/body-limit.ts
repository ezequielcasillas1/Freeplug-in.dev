import { SERVER_TOO_LARGE } from './copy'

/**
 * Server actions accept at most 6 MB (next.config.ts serverActions.bodySizeLimit "6mb", about
 * Netlify's request body limit). Next.js answers a bigger body with an HTTP 500 ("Body exceeded
 * 6mb limit", E394); the proxy calls this first and refuses it cleanly with a 413 and Sable's line
 * instead (Vera QA #4).
 *   * With a Content-Length: the header decides (Node never reads past it).
 *   * Without one (chunked, Vera r2 N5): the bytes are counted as they stream in, on a copy of the
 *     request, and counting stops at the first byte over 6 MB. Chunked uploads are not refused as
 *     such (Jace, round 5); only the size counts. The action still reads the untouched body.
 */
export const ACTION_BODY_LIMIT_BYTES = 6 * 1024 * 1024

type RequestLike = {
  method: string
  headers: { get(name: string): string | null }
  clone?: () => { body: ReadableStream<Uint8Array> | null }
}

function tooLarge(): Response {
  return new Response(SERVER_TOO_LARGE, {
    status: 413,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * Reads a stream until it ends or passes `limit` bytes, whichever comes first. True when it went
 * over. A stream that errors (e.g. the client hung up) counts as not over: there's nobody to answer.
 */
export async function streamExceeds(body: ReadableStream<Uint8Array> | null | undefined, limit: number): Promise<boolean> {
  if (!body) return false
  const reader = body.getReader()
  let n = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return false
      n += value?.byteLength ?? 0
      if (n > limit) {
        // Not awaited: cancelling one branch of a cloned (tee'd) body only settles once both
        // branches are cancelled, and the other branch belongs to Next.
        reader.cancel().catch(() => {})
        return true
      }
    }
  } catch {
    return false
  }
}

export async function oversizedActionResponse(req: RequestLike, limit: number = ACTION_BODY_LIMIT_BYTES): Promise<Response | null> {
  if (req.method !== 'POST' || !req.headers.get('next-action')) return null
  const header = req.headers.get('content-length')
  const length = header == null || header.trim() === '' ? NaN : Number(header)
  if (Number.isFinite(length)) return length > limit ? tooLarge() : null
  // No usable Content-Length: count the streamed bytes on a copy, so the body stays readable.
  if (!req.clone) return null
  let copy: ReadableStream<Uint8Array> | null = null
  try {
    copy = req.clone().body
  } catch {
    return null
  }
  return (await streamExceeds(copy, limit)) ? tooLarge() : null
}
