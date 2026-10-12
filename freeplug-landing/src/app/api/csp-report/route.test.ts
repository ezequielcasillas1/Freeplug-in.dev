// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

let allowed = true
vi.mock('@/lib/rate-limit', () => ({ rateCheck: async () => allowed }))

import { CSP_REPORT_MAX_BYTES, POST } from './route'

const req = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/csp-report', { method: 'POST', body, headers: { 'content-type': 'application/csp-report', ...headers } }) as never

describe('POST /api/csp-report', () => {
  beforeEach(() => {
    allowed = true
  })
  it('logs a short summary and answers 204', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await POST(req(JSON.stringify({ 'csp-report': { 'violated-directive': 'script-src', 'blocked-uri': 'https://x.example/a.js', secret: 'no' } })))
    expect(res.status).toBe(204)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][1])).toContain('script-src')
    expect(String(warn.mock.calls[0][1])).not.toContain('secret')
    warn.mockRestore()
  })
  it('drops oversized bodies unread', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const big = JSON.stringify({ 'csp-report': { 'violated-directive': 'x'.repeat(CSP_REPORT_MAX_BYTES) } })
    expect((await POST(req(big))).status).toBe(204)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
  it('rate limited: nothing logged', async () => {
    allowed = false
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect((await POST(req('{"csp-report":{}}'))).status).toBe(204)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
