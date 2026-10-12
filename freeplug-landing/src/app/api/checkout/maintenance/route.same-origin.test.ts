// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

// Past the same-origin check the route asks for the user; a sentinel error proves the check let it through.
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => { throw new Error('PASSED_ORIGIN_CHECK') } }))

const post = async (headers: Record<string, string>, url = 'http://localhost:3000/api/checkout/maintenance') => {
  const { POST } = await import('./route')
  try {
    return (await POST(new Request(url, { method: 'POST', headers }))).status
  } catch (e) {
    if (e instanceof Error && e.message === 'PASSED_ORIGIN_CHECK') return 'passed'
    throw e
  }
}

describe('POST /api/checkout/maintenance same-origin check', () => {
  it('cross-site POST gets 403 before auth runs', async () => {
    expect(await post({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' })).toBe(403)
  })
  it('Origin: null gets 403', async () => {
    expect(await post({ origin: 'null' })).toBe(403)
  })
  it('no Origin but Sec-Fetch-Site cross-site gets 403', async () => {
    expect(await post({ 'sec-fetch-site': 'cross-site' })).toBe(403)
  })
  it('same-origin POST is allowed', async () => {
    expect(await post({ origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' })).not.toBe(403)
  })
  it('no Origin header is allowed', async () => {
    expect(await post({})).not.toBe(403)
  })
  it('localhost review port (request origin) is allowed', async () => {
    expect(await post({ origin: 'http://localhost:3003' }, 'http://localhost:3003/api/checkout/maintenance')).not.toBe(403)
  })
})
