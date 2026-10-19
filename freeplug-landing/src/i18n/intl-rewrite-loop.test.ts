// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { INTL_LOCALE_HEADER, shouldRunIntlRouting } from './routing'

// Regression (Oct 13): Next re-runs the proxy on next-intl's rewrite target ('/' -> '/en'). Running
// next-intl again there redirected '/en' -> '/', so the English homepage looped 307 -> '/'.
describe('shouldRunIntlRouting', () => {
  const none = new Headers()
  const internal = new Headers({ [INTL_LOCALE_HEADER]: 'en' })

  it('runs next-intl on the public unprefixed pages (first pass)', () => {
    for (const p of ['/', '/faq', '/signup', '/request-website']) expect(shouldRunIntlRouting(p, none)).toBe(true)
  })

  it('skips the internal second pass of its own rewrite (/en, /en/faq with the locale header)', () => {
    expect(shouldRunIntlRouting('/en', internal)).toBe(false)
    expect(shouldRunIntlRouting('/en/faq', internal)).toBe(false)
  })

  it('a browser hitting /en directly (no header) still goes to next-intl, which redirects to /', () => {
    expect(shouldRunIntlRouting('/en', none)).toBe(true)
    expect(shouldRunIntlRouting('/en/faq', none)).toBe(true)
  })

  it('never touches app pages', () => {
    for (const p of ['/admin', '/dashboard', '/login', '/api/x']) expect(shouldRunIntlRouting(p, internal)).toBe(false)
  })
})
