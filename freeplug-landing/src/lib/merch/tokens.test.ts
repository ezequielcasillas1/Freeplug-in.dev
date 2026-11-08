// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  deriveMerchDownloadToken,
  generateMerchToken,
  hashMerchToken,
  issueMerchFontBundleToken,
  validateMerchToken,
  MERCH_TOKEN_TTL_MS,
} from './tokens'

describe('merch tokens', () => {
  it('hashes tokens deterministically', () => {
    const t = generateMerchToken()
    expect(hashMerchToken(t)).toHaveLength(64)
    expect(hashMerchToken(t)).toBe(hashMerchToken(t))
  })

  it('issues and validates a token', async () => {
    process.env.MERCH_TOKEN_SECRET = 'unit-test-secret'
    const inserts: unknown[] = []
    const store = new Map<string, Record<string, unknown>>()
    const admin = {
      from: (table: string) => ({
        insert: (row: Record<string, unknown>) => {
          inserts.push({ table, row })
          const id = 'row-1'
          store.set(row.token_hash as string, { ...row, id, download_count: 0, revoked_at: null })
          return Promise.resolve({ error: null })
        },
        select: () => ({
          eq: (_c: string, hash: string) => ({
            maybeSingle: async () => ({ data: store.get(hash) ?? null, error: null }),
          }),
        }),
      }),
    }
    const issued = await issueMerchFontBundleToken(admin as never, {
      stripeCheckoutSessionId: 'cs_test_1',
    })
    expect('token' in issued).toBe(true)
    if (!('token' in issued)) return
    const v = await validateMerchToken(admin as never, issued.token)
    expect(v.ok).toBe(true)
  })

  it('rejects expired tokens', async () => {
    const token = generateMerchToken()
    const hash = hashMerchToken(token)
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: '1',
                token_hash: hash,
                stripe_checkout_session_id: 'cs',
                expires_at: new Date(Date.now() - 1000).toISOString(),
                revoked_at: null,
                max_downloads: 5,
                download_count: 0,
              },
              error: null,
            }),
          }),
        }),
      }),
    }
    const v = await validateMerchToken(admin as never, token)
    expect(v.ok).toBe(false)
    if (v.ok) return
    expect(v.reason).toBe('expired')
  })

  it('TTL is about 24h', () => {
    expect(MERCH_TOKEN_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })

  it('derives stable session tokens', () => {
    process.env.MERCH_TOKEN_SECRET = 'unit-test-secret'
    const cs = 'cs_deterministic'
    expect(deriveMerchDownloadToken(cs)).toBe(deriveMerchDownloadToken(cs))
  })
})
