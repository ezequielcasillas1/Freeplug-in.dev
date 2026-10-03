// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACTION_BODY_LIMIT_BYTES, oversizedActionResponse, streamExceeds } from './body-limit'
import { customerMessage } from './errors'

const req = (method: string, h: Record<string, string>) => ({ method, headers: new Headers(h) })

describe('oversized server-action body (Vera QA #4)', () => {
  it('a 12.6 MB upload gets a 413 with Sable’s 12:49 AM line, not an HTTP 500', async () => {
    const res = await oversizedActionResponse(req('POST', { 'next-action': 'abc123', 'content-length': String(Math.round(12.6 * 1024 * 1024)) }))
    expect(res?.status).toBe(413)
    expect(await res!.text()).toBe('That photo is too large to upload. Try a smaller photo, or email it to support@freeplug-in.dev.')
  })

  it('lets through bodies within the limit and non-action requests', async () => {
    expect(await oversizedActionResponse(req('POST', { 'next-action': 'a', 'content-length': String(ACTION_BODY_LIMIT_BYTES) }))).toBeNull()
    expect(await oversizedActionResponse(req('POST', { 'content-length': String(ACTION_BODY_LIMIT_BYTES + 1) }))).toBeNull()
    expect(await oversizedActionResponse(req('GET', { 'next-action': 'a', 'content-length': String(ACTION_BODY_LIMIT_BYTES + 1) }))).toBeNull()
  })

  it('uses the same 6 MB as next.config.ts, and the proxy runs it before anything else', () => {
    expect(ACTION_BODY_LIMIT_BYTES).toBe(6 * 1024 * 1024)
    const root = path.join(__dirname, '../../..')
    expect(readFileSync(path.join(root, 'next.config.ts'), 'utf8')).toMatch(/bodySizeLimit:\s*['"]6mb['"]/)
    const proxy = readFileSync(path.join(root, 'src/proxy.ts'), 'utf8')
    expect(proxy).toContain('await oversizedActionResponse(request)')
    expect(proxy.indexOf('oversizedActionResponse(request)')).toBeLessThan(proxy.indexOf('updateSession(request)'))
  })
})

// A chunked body: no Content-Length, delivered in pieces (Vera r2 N5, Jace round 5).
function chunked(total: number, chunk = 64 * 1024, onPull?: () => void): ReadableStream<Uint8Array> {
  let sent = 0
  return new ReadableStream<Uint8Array>({
    pull(c) {
      onPull?.()
      if (sent >= total) return c.close()
      const n = Math.min(chunk, total - sent)
      sent += n
      c.enqueue(new Uint8Array(n))
    },
  })
}
const streamReq = (total: number, h: Record<string, string> = { 'next-action': 'a', 'transfer-encoding': 'chunked' }) => {
  const r = new Request('http://localhost/preview', { method: 'POST', headers: h, body: chunked(total), duplex: 'half' } as RequestInit)
  return r
}

describe('chunked server-action bodies (no Content-Length) are counted as they stream (Vera r2 N5)', () => {
  it('7 MB streamed without Content-Length gets the same 413 and line', async () => {
    const res = await oversizedActionResponse(streamReq(7 * 1024 * 1024))
    expect(res?.status).toBe(413)
    expect(await res!.text()).toBe('That photo is too large to upload. Try a smaller photo, or email it to support@freeplug-in.dev.')
  })

  it('exactly 6 MB streamed passes, and the original body is still readable in full afterwards', async () => {
    const r = streamReq(ACTION_BODY_LIMIT_BYTES)
    expect(await oversizedActionResponse(r)).toBeNull()
    expect((await r.arrayBuffer()).byteLength).toBe(ACTION_BODY_LIMIT_BYTES)
  })

  it('a small chunked action body is not refused (chunked alone is fine) and stays intact', async () => {
    const r = new Request('http://localhost/preview', { method: 'POST', headers: { 'next-action': 'a' }, body: '["hello"]' })
    r.headers.delete('content-length')
    expect(await oversizedActionResponse(r)).toBeNull()
    expect(await r.text()).toBe('["hello"]')
  })

  it('stops reading at the first byte over the limit (a 100 MB stream is not read to the end)', async () => {
    let pulls = 0
    const over = await streamExceeds(chunked(100 * 1024 * 1024, 64 * 1024, () => pulls++), ACTION_BODY_LIMIT_BYTES)
    expect(over).toBe(true)
    expect(pulls).toBeLessThan(ACTION_BODY_LIMIT_BYTES / (64 * 1024) + 4)
  })

  it('a stream that errors is not a crash (no 500 from the proxy)', async () => {
    const broken = () => new ReadableStream<Uint8Array>({ pull: (c) => c.error(new Error('client went away')) })
    expect(await streamExceeds(broken(), 10)).toBe(false)
    const r = { method: 'POST', headers: new Headers({ 'next-action': 'a' }), clone: () => ({ body: broken() }) }
    expect(await oversizedActionResponse(r)).toBeNull()
    const throwing = { method: 'POST', headers: new Headers({ 'next-action': 'a' }), clone: () => { throw new TypeError('body used') } }
    expect(await oversizedActionResponse(throwing)).toBeNull()
  })

  it('a bogus Content-Length (not a number) falls back to counting', async () => {
    const r = { method: 'POST', headers: new Headers({ 'next-action': 'a', 'content-length': 'lots' }), clone: () => ({ body: chunked(7 * 1024 * 1024) }) }
    expect((await oversizedActionResponse(r))?.status).toBe(413)
  })
})

describe('server refusal wording matches the server rule (Vera QA #5, Sable 12:49 AM)', () => {
  it('too large and wrong type never promise 10 MB or HEIC', () => {
    expect(customerMessage('too_large')).toBe('That photo is too large to upload. Try a smaller photo, or email it to support@freeplug-in.dev.')
    expect(customerMessage('bad_type')).toBe("We couldn't use this photo. Try it as a JPG or PNG, or email it to support@freeplug-in.dev.")
    expect(customerMessage('unreadable')).toBe(customerMessage('bad_type'))
    for (const code of ['too_large', 'bad_type', 'unreadable']) expect(customerMessage(code)).not.toMatch(/10 MB|HEIC/)
  })
})
