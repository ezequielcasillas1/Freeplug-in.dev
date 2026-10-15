import { describe, expect, it } from 'vitest'
import {
  RESET_COOKIE_MAX_AGE_SECONDS,
  isRecoveryAccessToken,
  signResetToken,
  verifyResetToken,
} from './reset-cookie'

const SECRET = 'test-secret'
const UID = '3772f781-2fa6-461a-b4d2-05a9a928e15a'

function fakeJwt(claims: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'HS256' })}.${enc(claims)}.sig`
}

describe('reset cookie token', () => {
  const t = 1_700_000_000_000
  const token = signResetToken(UID, SECRET, t)

  it('verifies for the same user within 15 minutes', () => {
    expect(verifyResetToken(token, UID, SECRET, t + 60_000)).toBe(true)
  })

  it('expires after 15 minutes', () => {
    expect(verifyResetToken(token, UID, SECRET, t + RESET_COOKIE_MAX_AGE_SECONDS * 1000 + 1)).toBe(false)
  })

  it('rejects another user, a different secret, tampering, and junk', () => {
    expect(verifyResetToken(token, 'someone-else', SECRET, t)).toBe(false)
    expect(verifyResetToken(token, UID, 'other-secret', t)).toBe(false)
    const [uid, exp, sig] = token.split('.')
    expect(verifyResetToken(`${uid}.${Number(exp) + 999_999}.${sig}`, UID, SECRET, t)).toBe(false)
    expect(verifyResetToken('garbage', UID, SECRET, t)).toBe(false)
    expect(verifyResetToken(undefined, UID, SECRET, t)).toBe(false)
    expect(verifyResetToken(token, null, SECRET, t)).toBe(false)
    expect(verifyResetToken(token, UID, '', t)).toBe(false)
  })
})

describe('isRecoveryAccessToken', () => {
  it('detects the recovery amr method', () => {
    expect(isRecoveryAccessToken(fakeJwt({ amr: [{ method: 'recovery', timestamp: 1 }] }))).toBe(true)
    expect(isRecoveryAccessToken(fakeJwt({ amr: [{ method: 'password', timestamp: 1 }] }))).toBe(false)
    expect(isRecoveryAccessToken('not-a-jwt')).toBe(false)
    expect(isRecoveryAccessToken(undefined)).toBe(false)
  })
})
