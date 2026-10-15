import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestAwareBaseUrl } from './site'

describe('requestAwareBaseUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses the local origin in development on localhost / 127.0.0.1', () => {
    expect(requestAwareBaseUrl({ host: 'localhost:3000' }, { nodeEnv: 'development' })).toBe(
      'http://localhost:3000'
    )
    expect(
      requestAwareBaseUrl({ host: '127.0.0.1:3100', forwardedProto: 'http' }, { nodeEnv: 'development' })
    ).toBe('http://127.0.0.1:3100')
    expect(
      requestAwareBaseUrl({ host: 'localhost', forwardedProto: 'https, http' }, { nodeEnv: 'development' })
    ).toBe('https://localhost')
  })

  it('ignores the Host header in production, even for localhost', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    expect(requestAwareBaseUrl({ host: 'localhost:3000' }, { nodeEnv: 'production' })).toBe(
      'https://freeplug-in.dev'
    )
  })

  it('ignores non-local hosts in development', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    for (const host of ['evil.example.com', 'localhost.evil.com', 'localhost:3000.evil.com', '10.0.0.5:3000', '']) {
      expect(requestAwareBaseUrl({ host }, { nodeEnv: 'development' })).toBe('https://freeplug-in.dev')
    }
  })

  it('keeps NEXT_PUBLIC_APP_URL / explicit fallback when not local dev', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://freeplug-in.dev/')
    expect(requestAwareBaseUrl({ host: 'freeplug-in.dev' }, { nodeEnv: 'production' })).toBe(
      'https://freeplug-in.dev'
    )
    expect(
      requestAwareBaseUrl({ host: 'x.example' }, { nodeEnv: 'production', fallback: 'http://localhost:3000' })
    ).toBe('http://localhost:3000')
  })
})
