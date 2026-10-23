import { describe, expect, it } from 'vitest'
import { isNewOAuthSignup } from './oauth-new-user'

const now = Date.parse('2026-10-23T18:00:00Z')
describe('isNewOAuthSignup', () => {
  it('flags a Google user created seconds ago', () => {
    expect(isNewOAuthSignup({ created_at: '2026-10-23T17:59:50Z', app_metadata: { provider: 'google', providers: ['google'] } }, now)).toBe(true)
  })
  it('allows an existing Google user', () => {
    expect(isNewOAuthSignup({ created_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'google' } }, now)).toBe(false)
  })
  it('allows an existing email user linking Google', () => {
    expect(isNewOAuthSignup({ created_at: '2025-05-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email', 'google'] } }, now)).toBe(false)
  })
  it('ignores non-Google users', () => {
    expect(isNewOAuthSignup({ created_at: '2026-10-23T17:59:50Z', app_metadata: { provider: 'email' } }, now)).toBe(false)
  })
  it('handles missing data', () => {
    expect(isNewOAuthSignup(null, now)).toBe(false)
    expect(isNewOAuthSignup({ created_at: 'bad', app_metadata: { provider: 'google' } }, now)).toBe(false)
  })
})
