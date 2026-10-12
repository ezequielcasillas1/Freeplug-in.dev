// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => { throw new Error('must not run') } }))

describe('POST /api/checkout/maintenance same-origin check', () => {
  it('cross-site POST gets 403 before auth runs', async () => {
    const { POST } = await import('./route')
    const res = await POST(new Request('http://localhost:3000/api/checkout/maintenance', { method: 'POST', headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } }))
    expect(res.status).toBe(403)
  })
})
