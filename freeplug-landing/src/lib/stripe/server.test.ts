// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { localStripeMockConfig } from './server'

describe('STRIPE_LOCAL_MOCK_URL (local e2e stacks only, round 9)', () => {
  const key = 'sk_test_local_mock'
  it('unset -> real Stripe (null)', () => {
    expect(localStripeMockConfig({ STRIPE_SECRET_KEY: key })).toBeNull()
    expect(localStripeMockConfig({ STRIPE_SECRET_KEY: key, STRIPE_LOCAL_MOCK_URL: '  ' })).toBeNull()
  })
  it('loopback + test key -> host/port/protocol', () => {
    expect(localStripeMockConfig({ STRIPE_SECRET_KEY: key, STRIPE_LOCAL_MOCK_URL: 'http://127.0.0.1:54413' })).toEqual({ host: '127.0.0.1', port: 54413, protocol: 'http' })
    expect(localStripeMockConfig({ STRIPE_SECRET_KEY: key, STRIPE_LOCAL_MOCK_URL: 'http://localhost:9' })).toMatchObject({ host: 'localhost', port: 9 })
    expect(localStripeMockConfig({ STRIPE_SECRET_KEY: key, STRIPE_LOCAL_MOCK_URL: 'http://[::1]:9' })).toMatchObject({ host: '::1', port: 9 })
  })
  it('refuses any non-loopback host', () => {
    for (const u of ['https://api.stripe.com', 'http://10.0.0.5:80', 'http://localhost.evil.test', 'http://127.0.0.1.nip.io', 'file:///tmp/x']) {
      expect(() => localStripeMockConfig({ STRIPE_SECRET_KEY: key, STRIPE_LOCAL_MOCK_URL: u }), u).toThrow()
    }
  })
  it('refuses a live or missing key, so live billing can never be redirected', () => {
    expect(() => localStripeMockConfig({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_LOCAL_MOCK_URL: 'http://127.0.0.1:1' })).toThrow(/test key/)
    expect(() => localStripeMockConfig({ STRIPE_LOCAL_MOCK_URL: 'http://127.0.0.1:1' })).toThrow(/test key/)
    expect(() => localStripeMockConfig({ STRIPE_SECRET_KEY: 'rk_live_x', STRIPE_LOCAL_MOCK_URL: 'http://127.0.0.1:1' })).toThrow()
  })
  it('refuses a malformed URL', () => {
    expect(() => localStripeMockConfig({ STRIPE_SECRET_KEY: key, STRIPE_LOCAL_MOCK_URL: 'not a url' })).toThrow(/valid URL/)
  })
})
