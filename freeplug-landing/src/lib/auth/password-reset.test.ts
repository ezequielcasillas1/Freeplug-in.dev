import { describe, expect, it } from 'vitest'
import {
  isGoogleOnlyUser,
  isResetThrottledForEmail,
  isResetThrottledForIp,
  recoveryConfirmUrl,
  PASSWORD_MIN_LENGTH,
} from './password-reset'
import { safeNext } from './safe-next'

describe('password reset helpers', () => {
  it('builds the /auth/confirm recovery link on the given base URL', () => {
    const link = new URL(recoveryConfirmUrl('https://freeplug-in.dev', 'abc123'))
    expect(link.origin).toBe('https://freeplug-in.dev')
    expect(link.pathname).toBe('/auth/confirm')
    expect(link.searchParams.get('token_hash')).toBe('abc123')
    expect(link.searchParams.get('type')).toBe('recovery')
    expect(link.searchParams.get('next')).toBe('/reset-password')
  })

  it('safeNext keeps /reset-password', () => {
    expect(safeNext('/reset-password')).toBe('/reset-password')
  })

  it('throttles repeat requests for the same email within a minute', () => {
    const t = 1_000_000
    expect(isResetThrottledForEmail('Someone@Example.com', t)).toBe(false)
    expect(isResetThrottledForEmail('someone@example.com', t + 10_000)).toBe(true)
    expect(isResetThrottledForEmail('someone@example.com', t + 61_000)).toBe(false)
  })

  it('allows 5 requests per IP per 10 minutes', () => {
    const t = 2_000_000
    for (let i = 0; i < 5; i++) expect(isResetThrottledForIp('203.0.113.9', t + i)).toBe(false)
    expect(isResetThrottledForIp('203.0.113.9', t + 10)).toBe(true)
    expect(isResetThrottledForIp('203.0.113.9', t + 600_001)).toBe(false)
  })

  it('detects Google-only accounts', () => {
    expect(isGoogleOnlyUser({ identities: [{ provider: 'google' }] })).toBe(true)
    expect(isGoogleOnlyUser({ identities: [{ provider: 'google' }, { provider: 'email' }] })).toBe(false)
    expect(isGoogleOnlyUser({ identities: [{ provider: 'email' }] })).toBe(false)
    expect(isGoogleOnlyUser({ identities: [], app_metadata: { providers: ['google'] } })).toBe(true)
    expect(isGoogleOnlyUser(null)).toBe(false)
  })

  it('uses the same minimum length as signup', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6)
  })
})
