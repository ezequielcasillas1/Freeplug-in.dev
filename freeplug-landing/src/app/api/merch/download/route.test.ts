// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { generateMerchToken, hashMerchToken } from '@/lib/merch/tokens'

const row = {
  id: 'uuid-1',
  token_hash: '',
  stripe_checkout_session_id: 'cs',
  expires_at: new Date(Date.now() + 60_000).toISOString(),
  revoked_at: null,
  max_downloads: 5,
  download_count: 0,
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_: string, hash: string) => ({
          maybeSingle: async () => ({
            data: hash === row.token_hash ? { ...row, token_hash: hash } : null,
            error: null,
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { download_count: 1 }, error: null }),
            }),
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/merch/storage', () => ({
  readMerchBundleBytes: async () => Buffer.from('zip-bytes'),
  isMerchMockBundle: () => false,
  merchDownloadFilename: () => 'freeplug-font-bundle-v1.zip',
}))

import { GET } from './route'

describe('GET /api/merch/download', () => {
  beforeEach(() => {
    const token = generateMerchToken()
    row.token_hash = hashMerchToken(token)
    ;(global as unknown as { __merchTestToken: string }).__merchTestToken = token
  })

  it('rejects missing token', async () => {
    const res = await GET(new Request('http://localhost/api/merch/download'))
    expect(res.status).toBe(400)
  })

  it('serves bundle for valid token', async () => {
    const token = (global as unknown as { __merchTestToken: string }).__merchTestToken
    const res = await GET(new Request(`http://localhost/api/merch/download?token=${encodeURIComponent(token)}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('freeplug-font-bundle-v1.zip')
  })

  it('rejects invalid token', async () => {
    const res = await GET(new Request('http://localhost/api/merch/download?token=not-a-real-token-value'))
    expect(res.status).toBe(404)
  })
})
