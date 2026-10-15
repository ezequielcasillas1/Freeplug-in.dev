import { describe, expect, it } from 'vitest'
import { isGoogleSignInEnabled } from './google-enabled'

const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

const base = { url: 'http://127.0.0.1:54321', key: 'anon' }

describe('isGoogleSignInEnabled', () => {
  it('false when the auth settings say google is off (local Docker stack)', async () => {
    expect(await isGoogleSignInEnabled({ ...base, fetchImpl: json({ external: { google: false } }) })).toBe(false)
  })
  it('true when google is on (hosted)', async () => {
    expect(await isGoogleSignInEnabled({ ...base, fetchImpl: json({ external: { google: true } }) })).toBe(true)
  })
  it('fails open on an HTTP error, a network error, odd JSON or missing config', async () => {
    expect(await isGoogleSignInEnabled({ ...base, fetchImpl: json({}, 500) })).toBe(true)
    expect(
      await isGoogleSignInEnabled({ ...base, fetchImpl: (async () => { throw new Error('down') }) as unknown as typeof fetch })
    ).toBe(true)
    expect(await isGoogleSignInEnabled({ ...base, fetchImpl: json({ nope: 1 }) })).toBe(true)
    expect(await isGoogleSignInEnabled({ url: '', key: '', fetchImpl: json({ external: { google: false } }) })).toBe(true)
  })
  it('sends the anon key and calls /auth/v1/settings', async () => {
    let seen = ''
    let key = ''
    const f = (async (u: string, init: RequestInit) => {
      seen = u
      key = String((init.headers as Record<string, string>).apikey)
      return new Response('{"external":{"google":false}}')
    }) as unknown as typeof fetch
    await isGoogleSignInEnabled({ url: 'http://127.0.0.1:54321/', key: 'anon', fetchImpl: f })
    expect(seen).toBe('http://127.0.0.1:54321/auth/v1/settings')
    expect(key).toBe('anon')
  })
})
