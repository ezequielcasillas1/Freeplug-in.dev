// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * LOCAL SAFETY for "Send it again" (round 7). Runs the REAL Supabase server client (@supabase/ssr)
 * and the real resendSignupConfirmation against a throwaway local HTTP server standing in for
 * Supabase (like the r7 mock on 54391). Proves:
 *   - the resend goes to NEXT_PUBLIC_SUPABASE_URL (here the local server) and nowhere else: every
 *     fetch made during the call is recorded and all of them hit the local server;
 *   - it is Supabase Auth's POST /auth/v1/resend with type "signup" and the session user's email;
 *   - the app's own SMTP mailer is never called (and the module doesn't import it).
 */
const sendMail = vi.fn()
vi.mock('@/lib/email/smtp', () => ({ sendMail, isSmtpConfigured: () => true }))
vi.mock('@/lib/email/send', () => ({ sendPasswordResetEmail: sendMail }))
vi.mock('@/lib/rate-limit', () => ({ rateCheck: async () => true }))
const jar = vi.hoisted(() => ({ cookies: [] as { name: string; value: string }[] }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => jar.cookies, set: () => {} }),
  headers: async () => new Headers(),
}))

import { resendSignupConfirmation } from './resend-confirmation'

const USER = { id: 'e2e00000-0000-4000-8000-000000000021', email: 'unconfirmed-r7@local.test' }
const seen: { method: string; path: string; body: string }[] = []
let server: http.Server
let base = ''

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      seen.push({ method: req.method ?? '', path: req.url ?? '', body: Buffer.concat(chunks).toString() })
      res.setHeader('content-type', 'application/json')
      if (req.url === '/auth/v1/user') {
        res.end(JSON.stringify({ id: USER.id, aud: 'authenticated', role: 'authenticated', email: USER.email, email_confirmed_at: null, app_metadata: {}, user_metadata: {}, created_at: '2026-09-27T07:00:00Z' }))
      } else if (req.url?.startsWith('/auth/v1/resend')) {
        res.end(JSON.stringify({}))
      } else {
        res.statusCode = 404
        res.end(JSON.stringify({ msg: 'not here' }))
      }
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', base)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'local-anon-key')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3322')
  const session = {
    access_token: 'local-access-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'local-refresh', user: { id: USER.id, aud: 'authenticated', role: 'authenticated', email: USER.email, app_metadata: {}, user_metadata: {} },
  }
  jar.cookies = [{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url') }]
})
afterAll(async () => {
  vi.unstubAllEnvs()
  await new Promise((r) => server.close(r))
})

describe('resend never leaves the configured local Supabase stand-in (round 7)', () => {
  it('records the resend on the local server, contacts nothing else, and never uses SMTP', async () => {
    const realFetch = globalThis.fetch
    const urls: string[] = []
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      return realFetch(input, init)
    }) as typeof fetch
    try {
      expect(await resendSignupConfirmation()).toBe('sent')
    } finally {
      globalThis.fetch = realFetch
    }
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every((u) => u.startsWith(`${base}/`))).toBe(true)
    const resend = seen.filter((s) => s.method === 'POST' && s.path.startsWith('/auth/v1/resend'))
    expect(resend).toHaveLength(1)
    const body = JSON.parse(resend[0].body)
    expect(body.type).toBe('signup')
    expect(body.email).toBe(USER.email)
    expect(decodeURIComponent(resend[0].path)).toContain('redirect_to=http://localhost:3322/auth/callback?next=%2Fclaim')
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('the resend module has no mailer import (only Supabase Auth sends the email)', () => {
    const src = readFileSync(path.join(__dirname, 'resend-confirmation.ts'), 'utf8')
    expect(src).not.toMatch(/from '@\/lib\/email/)
    expect(src).not.toMatch(/nodemailer|smtp/i)
  })
})
