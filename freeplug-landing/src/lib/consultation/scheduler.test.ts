import { afterEach, describe, expect, it, vi } from 'vitest'
import { calcomEmbedUrl, calcomLink, parseCalcomMessage } from './scheduler'

afterEach(() => vi.unstubAllEnvs())

describe('Cal.com scheduler', () => {
  it('unset link = test mode', () => {
    vi.stubEnv('NEXT_PUBLIC_CALCOM_LINK', '')
    expect(calcomLink()).toBeNull()
  })
  it('accepts a path or full cal.com URL, rejects anything else', () => {
    vi.stubEnv('NEXT_PUBLIC_CALCOM_LINK', 'https://cal.com/freeplug/consultation/')
    expect(calcomLink()).toBe('freeplug/consultation')
    vi.stubEnv('NEXT_PUBLIC_CALCOM_LINK', 'javascript:alert(1)')
    expect(calcomLink()).toBeNull()
  })
  it('builds the embed URL with prefill', () => {
    const u = new URL(calcomEmbedUrl('freeplug/consultation', { email: 'a@b.co', method: 'phone', ref: 'r1' }))
    expect(u.origin).toBe('https://cal.com')
    expect(u.searchParams.get('embed')).toBe('true')
    expect(u.searchParams.get('email')).toBe('a@b.co')
    expect(u.searchParams.get('metadata[method]')).toBe('phone')
  })
  it('reads bookingSuccessful only from cal.com', () => {
    const msg = { type: 'bookingSuccessful', data: { booking: { uid: 'abc', startTime: '2026-10-23T15:00:00Z' } } }
    expect(parseCalcomMessage('https://cal.com', msg)).toEqual({ uid: 'abc', startTime: '2026-10-23T15:00:00Z' })
    expect(parseCalcomMessage('https://evil.example', msg)).toBeNull()
    expect(parseCalcomMessage('https://cal.com', { type: 'other' })).toBeNull()
  })
})
