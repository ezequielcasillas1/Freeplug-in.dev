import { describe, expect, it } from 'vitest'
import { CHANGE_REQUEST_SUBMIT_KEYS, friendlyInsertError } from './submit-errors'

describe('friendlyInsertError (ruling 8)', () => {
  it('maps the trigger tokens and the length check; anything else is not customer-facing', () => {
    expect(friendlyInsertError({ code: 'P0001', message: 'change_requests_pending_cap' })).toMatch(/^You already have 10 change requests/)
    expect(friendlyInsertError({ code: 'P0001', message: 'change_requests_daily_cap' })).toMatch(/^You've sent 20 change requests/)
    expect(friendlyInsertError({ code: '23514', message: 'violates check constraint "change_requests_description_check"' })).toBe('Please keep your request under 2,000 characters.')
    expect(friendlyInsertError({ code: '42501', message: 'new row violates row-level security policy' })).toBeNull()
    expect(friendlyInsertError(null)).toBeNull()
  })
  it('one key per line', () => {
    const k = Object.values(CHANGE_REQUEST_SUBMIT_KEYS)
    expect(new Set(k).size).toBe(4)
  })
})
