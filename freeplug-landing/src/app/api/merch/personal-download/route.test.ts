// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/merch/storage', () => ({
  readMerchPersonalDemoBytes: async () => Buffer.from('demo'),
  isMerchPersonalDemoMock: () => true,
  MERCH_PERSONAL_DEMO_FILENAME: 'freeplug-fonts-personal-demo.zip',
}))

vi.mock('@/lib/rate-limit', () => ({
  rateCheck: vi.fn(async () => true),
}))

import { POST } from './route'

describe('POST /api/merch/personal-download', () => {
  beforeEach(() => {
    process.env.MERCH_PERSONAL_DOWNLOAD_ENABLED = 'true'
  })

  it('returns 403 when flag is off', async () => {
    process.env.MERCH_PERSONAL_DOWNLOAD_ENABLED = 'false'
    const res = await POST(
      new Request('http://localhost/api/merch/personal-download', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
        body: '{}',
      })
    )
    expect(res.status).toBe(403)
  })

  it('returns zip when enabled', async () => {
    const res = await POST(
      new Request('http://localhost:3000/api/merch/personal-download', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
        body: '{}',
      })
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('freeplug-fonts-personal-demo.zip')
  })
})
