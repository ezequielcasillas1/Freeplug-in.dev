// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  CHANGE_WEBHOOK_TIMEOUT_MS,
  changeWebhookConfig,
  normalizeWebhookKey,
  parseWebhookUrl,
  postChangeRequestWebhook,
  webhookAuthHeader,
} from './webhook'
import { buildChangeRequestPayload } from './payload'

const payload = buildChangeRequestPayload(
  {
    id: '6f1c2a9e-3b7d-4e8a-9c41-2d5f8a7b0c13',
    business_name: 'Rivera Plumbing',
    change_type: 'Photos',
    page: 'Home',
    description: 'Swap the hero photo',
    photo_name: null,
    plan_step: 'starter',
    billing: 'included',
    created_at: '2026-10-04T20:05:00.000Z',
  },
  'http://localhost:3381'
)

describe('webhook key and header (Grok Bot: Authorization: Bearer <key>)', () => {
  it.each([
    ['fake-key-123', 'fake-key-123'],
    ['  fake-key-123 \n', 'fake-key-123'],
    ['Bearer fake-key-123', 'fake-key-123'],
    ['bearer fake-key-123', 'fake-key-123'],
    ['BEARER    fake-key-123  ', 'fake-key-123'],
    ['  Bearer\tfake-key-123', 'fake-key-123'],
    ['Bearer Bearer fake-key-123', 'fake-key-123'],
    ['Bearer', ''],
    ['   ', ''],
    ['BearerToken', 'BearerToken'],
  ])('normalizeWebhookKey(%j) = %j', (raw, key) => {
    expect(normalizeWebhookKey(raw)).toBe(key)
  })

  it('never sends "Bearer Bearer"', () => {
    for (const raw of ['fake', 'Bearer fake', 'bearer  fake', ' BEARER fake ', 'Bearer Bearer fake']) {
      expect(webhookAuthHeader(raw)).toBe('Bearer fake')
      expect(webhookAuthHeader(raw)).not.toMatch(/bearer\s+bearer/i)
    }
  })

  it('env: unset, blank, bare "Bearer" or a non-https URL means not configured', () => {
    expect(changeWebhookConfig({})).toBeNull()
    expect(changeWebhookConfig({ CHANGE_APPROVAL_WEBHOOK_URL: 'https://hooks.example/x' })).toBeNull()
    expect(changeWebhookConfig({ CHANGE_APPROVAL_WEBHOOK_URL: 'https://hooks.example/x', CHANGE_APPROVAL_WEBHOOK_KEY: ' Bearer ' })).toBeNull()
    expect(changeWebhookConfig({ CHANGE_APPROVAL_WEBHOOK_URL: 'http://hooks.example/x', CHANGE_APPROVAL_WEBHOOK_KEY: 'k' })).toBeNull()
    expect(changeWebhookConfig({ CHANGE_APPROVAL_WEBHOOK_URL: 'https://u:p@hooks.example/x', CHANGE_APPROVAL_WEBHOOK_KEY: 'k' })).toBeNull()
    expect(changeWebhookConfig({ CHANGE_APPROVAL_WEBHOOK_URL: 'https://hooks.example/x', CHANGE_APPROVAL_WEBHOOK_KEY: 'Bearer k' })?.key).toBe('k')
  })

  it('URL: https, or plain http only to a loopback receiver', () => {
    expect(parseWebhookUrl('https://hooks.example/x')?.host).toBe('hooks.example')
    expect(parseWebhookUrl('http://127.0.0.1:54499/hook')?.port).toBe('54499')
    expect(parseWebhookUrl('http://localhost:54499/hook')).not.toBeNull()
    expect(parseWebhookUrl('http://10.0.0.5/hook')).toBeNull()
    expect(parseWebhookUrl('ftp://hooks.example')).toBeNull()
    expect(parseWebhookUrl('not a url')).toBeNull()
  })

  it('the timeout is 5 s', () => {
    expect(CHANGE_WEBHOOK_TIMEOUT_MS).toBe(5000)
  })
})

describe('postChangeRequestWebhook against a local fake receiver', () => {
  type Hit = { method?: string; path?: string; auth?: string; type?: string; body: string }
  const hits: Hit[] = []
  let mode: 'ok' | '500' | 'slow' | 'redirect' = 'ok'
  let slowMs = 1000
  let server: http.Server
  let base = ''
  let redirectHits = 0
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/elsewhere') {
        redirectHits++
        res.writeHead(200).end()
        return
      }
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        hits.push({ method: req.method, path: req.url, auth: req.headers.authorization, type: req.headers['content-type'], body: Buffer.concat(chunks).toString() })
        if (mode === 'ok') res.writeHead(202).end('{"ok":true}')
        else if (mode === '500') res.writeHead(500).end('boom')
        else if (mode === 'redirect') res.writeHead(307, { location: `${base}/elsewhere` }).end()
        else setTimeout(() => res.writeHead(200).end(), slowMs)
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(async () => {
    server.closeAllConnections()
    await new Promise((r) => server.close(r))
  })
  beforeEach(() => {
    hits.length = 0
    redirectHits = 0
    mode = 'ok'
  })
  const config = () => ({ url: new URL(`${base}/hook`), key: normalizeWebhookKey('Bearer fake-local-key') })

  it('2xx: one POST with the Bearer header, JSON content type and the exact payload', async () => {
    const res = await postChangeRequestWebhook(config(), payload)
    expect(res).toEqual({ ok: true, status: 202 })
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ method: 'POST', path: '/hook', auth: 'Bearer fake-local-key', type: 'application/json' })
    expect(JSON.parse(hits[0].body)).toEqual(payload)
  })

  it('500: one try, error recorded without the URL or key', async () => {
    mode = '500'
    const res = await postChangeRequestWebhook(config(), payload)
    expect(res).toEqual({ ok: false, error: 'HTTP 500' })
    expect(hits).toHaveLength(1)
  })

  it('slow: aborted at the timeout, one try', async () => {
    mode = 'slow'
    slowMs = 1500
    const t0 = Date.now()
    const res = await postChangeRequestWebhook(config(), payload, { timeoutMs: 300 })
    expect(Date.now() - t0).toBeLessThan(1200)
    expect(res).toEqual({ ok: false, error: 'Timed out after 0.3s' })
    expect(hits).toHaveLength(1)
  })

  it('slow with the real 5 s default: gives up at ~5 s', async () => {
    mode = 'slow'
    slowMs = 7000
    const t0 = Date.now()
    const res = await postChangeRequestWebhook(config(), payload)
    const took = Date.now() - t0
    expect(res).toEqual({ ok: false, error: 'Timed out after 5s' })
    expect(took).toBeGreaterThanOrEqual(4900)
    expect(took).toBeLessThan(6500)
    expect(hits).toHaveLength(1)
  }, 15000)

  it('down (nothing listening): network error, never throws', async () => {
    const closed = http.createServer()
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', r))
    const port = (closed.address() as AddressInfo).port
    await new Promise((r) => closed.close(r))
    const res = await postChangeRequestWebhook({ url: new URL(`http://127.0.0.1:${port}/hook`), key: 'k' }, payload)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toMatch(/^Network error/)
      expect(res.error).not.toContain(String(port))
    }
  })

  it('a redirect is a failure and is not followed (the key goes only to the configured URL)', async () => {
    mode = 'redirect'
    const res = await postChangeRequestWebhook(config(), payload)
    expect(res).toEqual({ ok: false, error: 'HTTP 307' })
    expect(redirectHits).toBe(0)
  })
})
