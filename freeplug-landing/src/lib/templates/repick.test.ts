import { describe, expect, it } from 'vitest'
import { repickCookieName, showTypeCleared } from './repick'

describe('L1 type-changed banner', () => {
  it('shows from the cookie without ?repick=1 (survives Back / the request card)', () => {
    expect(showTypeCleared(undefined, '1', null)).toBe(true)
    expect(showTypeCleared('1', undefined, null)).toBe(true)
  })
  it('hides once a new pick exists or nothing flags it', () => {
    expect(showTypeCleared('1', '1', 'envato_catalog')).toBe(false)
    expect(showTypeCleared(undefined, undefined, null)).toBe(false)
  })
  it('cookie name is per request and sanitised', () => {
    expect(repickCookieName('ab-12;x=y')).toBe('fp_repick_ab-12')
  })
})
