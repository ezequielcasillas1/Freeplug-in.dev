// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PHOTO_LIMITS } from './limits'

const migration = readFileSync(
  path.join(__dirname, '../../../supabase/migrations/20260927050200_site_details.sql'),
  'utf8'
)

describe('photo limits', () => {
  it('the database caps match PHOTO_LIMITS (preview link, customer request, organic account)', () => {
    const cap = (name: string) => {
      const m = migration.match(new RegExp(`${name}\\s+constant\\s+integer\\s*:=\\s*(\\d+)`))
      expect(m, name).not.toBeNull()
      return Number(m![1])
    }
    expect(cap('cap_preview_link')).toBe(PHOTO_LIMITS.maxPerLink)
    expect(cap('cap_customer_request')).toBe(PHOTO_LIMITS.maxPerCustomerRequest)
    expect(cap('cap_organic_account')).toBe(PHOTO_LIMITS.maxPerOrganicAccount)
    // No stray hard-coded cap left in the trigger.
    expect(migration).not.toMatch(/n\s*>=\s*\d+/)
  })

  it('keeps the size limits from the spec (10 MB picked, 5 MB after shrinking, under the 6 MB body limit)', () => {
    expect(PHOTO_LIMITS.maxOriginalBytes).toBe(10 * 1024 * 1024)
    expect(PHOTO_LIMITS.maxUploadBytes).toBe(5 * 1024 * 1024)
    expect(PHOTO_LIMITS.uploadConcurrency).toBe(3)
  })

  it('next.config allows a 6 MB server-action body, not more', () => {
    const cfg = readFileSync(path.join(__dirname, '../../../next.config.ts'), 'utf8')
    expect(cfg).toMatch(/bodySizeLimit:\s*['"]6mb['"]/)
  })
})
