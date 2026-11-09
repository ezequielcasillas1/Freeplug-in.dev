import { describe, expect, it } from 'vitest'
import { DEFAULT_SIGNUP_BLOCK_CUTOFF, isPostCutoffUser, shouldBlockSignIn, signupBlockCutoffMs } from './oauth-new-user'

const cutoff = Date.parse(DEFAULT_SIGNUP_BLOCK_CUTOFF)

describe('signup block cutoff', () => {
  it('defaults to 2026-10-22 00:00 CT and is configurable', () => {
    expect(signupBlockCutoffMs(undefined)).toBe(Date.parse('2026-10-22T05:00:00Z'))
    expect(signupBlockCutoffMs('garbage')).toBe(cutoff)
    expect(signupBlockCutoffMs('2026-11-01T00:00:00Z')).toBe(Date.parse('2026-11-01T00:00:00Z'))
  })
  it('pre-cutoff user with a profile signs in (Google or email)', () => {
    expect(shouldBlockSignIn({ created_at: '2026-01-01T00:00:00Z' }, true, cutoff)).toBe(false)
    expect(shouldBlockSignIn({ created_at: '2026-10-22T04:59:59Z' }, true, cutoff)).toBe(false)
  })
  it('pre-cutoff user is not blocked when the profile lookup failed', () => {
    expect(shouldBlockSignIn({ created_at: '2026-01-01T00:00:00Z' }, null, cutoff)).toBe(false)
  })
  it('post-cutoff user is blocked, even days later and even with a profile', () => {
    expect(isPostCutoffUser({ created_at: '2026-10-22T05:00:00Z' }, cutoff)).toBe(true)
    expect(shouldBlockSignIn({ created_at: '2026-10-23T18:00:00Z' }, true, cutoff)).toBe(true)
  })
  it('a user with no profile row is blocked', () => {
    expect(shouldBlockSignIn({ created_at: '2025-05-01T00:00:00Z' }, false, cutoff)).toBe(true)
  })
  it('unparsable created_at fails closed; no user is not blocked', () => {
    expect(shouldBlockSignIn({ created_at: 'bad' }, true, cutoff)).toBe(true)
    expect(shouldBlockSignIn(null, null, cutoff)).toBe(false)
  })
})
