// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PHONE_INVALID } from './copy'
import { displayPhone, normalizePhone } from './phone'
import { detailsSubmissionSchema } from './schemas'

describe('phone numbers are 10 digits and saved as 512-555-0142 (Vera r2 bug 3)', () => {
  it.each([
    ['5125550142'],
    ['512-555-0142'],
    ['(512) 555-0142'],
    ['(512) 555.0142'],
    ['512 555 0142'],
    ['+1 512 555 0142'],
    ['1-512-555-0142'],
    ['  512.555.0142  '],
  ])('%s → 512-555-0142', (raw) => {
    expect(normalizePhone(raw)).toBe('512-555-0142')
  })

  it.each([['555-0142'], ['512555014'], ['51255501420'], ['2-512-555-0142'], ['512-555-0142 ext 2'], ['call 5125550142'], ['']])('%s is refused', (raw) => {
    expect(normalizePhone(raw)).toBeNull()
  })

  it('displayPhone formats valid numbers and leaves anything else as it is', () => {
    expect(displayPhone('5125550142')).toBe('512-555-0142')
    expect(displayPhone('ask for Maria')).toBe('ask for Maria')
  })

  it('the server schema stores the normalized number and refuses a short one with the exact message', () => {
    const ok = detailsSubmissionSchema.safeParse({ fields: { phone: '(512) 555 0142' }, services: [] })
    expect(ok.success && ok.data.fields.phone).toBe('512-555-0142')
    const bad = detailsSubmissionSchema.safeParse({ fields: { phone: '555-0142' }, services: [] })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0]?.message).toBe(PHONE_INVALID)
    expect(PHONE_INVALID).toBe('Please enter a 10-digit phone number, including the area code.')
  })

  it('an empty phone is still allowed (optional in the preview)', () => {
    const ok = detailsSubmissionSchema.safeParse({ fields: {}, services: [] })
    expect(ok.success).toBe(true)
  })
})
