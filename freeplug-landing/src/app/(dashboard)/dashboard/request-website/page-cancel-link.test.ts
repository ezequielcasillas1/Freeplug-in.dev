import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CANCEL_OPTIONS_LINK } from '@/lib/plans/ladder-copy'
import { CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE } from '@/lib/stripe/active-subscription'

// Lina, round 5b: under the close-blocked message the request page links to the cancel page
// ("Cancel options"), matching the message, instead of a Manage billing button.
describe('request page: close-blocked message links to Cancel options', () => {
  const src = readFileSync(join(__dirname, 'page.tsx'), 'utf8')
  it('a Cancel options text link to /dashboard/cancel, no Manage billing button or portal form', () => {
    expect(CANCEL_OPTIONS_LINK).toBe('Cancel options')
    expect(src).toMatch(/<Link\s+href="\/dashboard\/cancel"[\s\S]*?\{CANCEL_OPTIONS_LINK\}/)
    expect(src).not.toMatch(/Manage billing/)
    expect(src).not.toMatch(/openBillingPortal/)
    expect(CLOSE_BLOCKED_ACTIVE_PLAN_MESSAGE).toContain('choose Cancel options in your dashboard')
  })
  it('the /dashboard/cancel route exists', () => {
    expect(existsSync(join(__dirname, '..', 'cancel', 'page.tsx'))).toBe(true)
  })
})
