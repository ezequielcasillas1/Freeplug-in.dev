import { describe, expect, it } from 'vitest'
import { canStartBuild, consultationStage, isPreAgreement, OPEN_REQUEST_STATUSES, WEBSITE_REQUEST_STATUSES } from './status'

const base = { path: 'form' as const, booked_at: null, booking_ref: null, ready_for_review_at: null, agreed_at: null }

describe('consultation status', () => {
  it('has the full flow in order', () => {
    expect(WEBSITE_REQUEST_STATUSES).toEqual(['submitted', 'in_review', 'consultation', 'agreed', 'building', 'closed'])
    expect(OPEN_REQUEST_STATUSES).not.toContain('closed')
  })
  it('derives the client stage', () => {
    expect(consultationStage(null)).toBe('choose')
    expect(consultationStage(base)).toBe('form_draft')
    expect(consultationStage({ ...base, path: 'live' })).toBe('live_booking')
    expect(consultationStage({ ...base, path: 'live', booked_at: '2026-10-23T15:00:00Z' })).toBe('live_waiting')
    expect(consultationStage({ ...base, ready_for_review_at: 'x' })).toBe('review')
    expect(consultationStage({ ...base, ready_for_review_at: 'x', agreed_at: 'y' })).toBe('agreed')
  })
  it('only agreed consultations can start a build', () => {
    expect(canStartBuild(null)).toBe(false)
    expect(canStartBuild({ agreed_at: null })).toBe(false)
    expect(canStartBuild({ agreed_at: '2026-10-22T20:00:00Z' })).toBe(true)
    expect(isPreAgreement('consultation')).toBe(true)
    expect(isPreAgreement('agreed')).toBe(false)
  })
})
