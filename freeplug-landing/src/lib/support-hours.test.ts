import { describe, expect, it } from 'vitest'
import { HELP_CHAT_NOT_FOUND } from '@/lib/help/help-chat-content'
import {
  SUPPORT_AVAILABILITY_LABEL,
  SUPPORT_AVAILABILITY_LINE,
  SUPPORT_CARD_LINE,
  SUPPORT_HOURS,
} from './support-hours'

describe('support hours copy (exact, per Ezequiel Sep 25, 2026)', () => {
  it('uses the exact approved lines', () => {
    expect(SUPPORT_HOURS).toBe(
      'Monday to Wednesday, 1 to 2 PM, and Thursday and Friday, 1 to 3 PM (Central time)'
    )
    expect(SUPPORT_AVAILABILITY_LABEL).toBe("When we're available")
    expect(SUPPORT_AVAILABILITY_LINE).toBe('Our team is available during the support hours below.')
    expect(SUPPORT_CARD_LINE).toBe(
      'Our team is available Monday to Wednesday, 1 to 2 PM, and Thursday and Friday, 1 to 3 PM (Central time).'
    )
    expect(HELP_CHAT_NOT_FOUND).toBe(
      "Didn't find your answer? Email support@freeplug-in.dev. Our team is available Monday to Wednesday, 1 to 2 PM, and Thursday and Friday, 1 to 3 PM (Central time)."
    )
  })

  it('makes no reply-time promise', () => {
    for (const s of [SUPPORT_AVAILABILITY_LINE, SUPPORT_CARD_LINE, HELP_CHAT_NOT_FOUND]) {
      expect(s).not.toMatch(/24 hours|within|EST|9am/i)
    }
  })
})
