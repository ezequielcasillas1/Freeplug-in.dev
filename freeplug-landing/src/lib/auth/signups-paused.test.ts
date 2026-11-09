import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { SIGNUPS_PAUSED, signupPausedLine, signupPausedLoginPath } from './signups-paused'

describe('sign-up hidden while paused', () => {
  it('redirect targets carry the notice, the language and next=/claim only', () => {
    expect(SIGNUPS_PAUSED).toBe(true)
    expect(signupPausedLoginPath('en')).toBe('/login?notice=signup-paused')
    expect(signupPausedLoginPath('es')).toBe('/login?notice=signup-paused&lang=es')
    expect(signupPausedLoginPath('en', '/claim')).toBe('/login?notice=signup-paused&next=%2Fclaim')
    expect(signupPausedLoginPath('en', 'https://evil.example')).toBe('/login?notice=signup-paused')
  })
  it('reuses the maintenance wording', () => {
    expect(signupPausedLine('en')).toBe('Sign-up is paused while we do some site maintenance.')
    expect(signupPausedLine('es')).toBe('El registro está en pausa mientras damos mantenimiento al sitio.')
  })
  it('no landing component links to /signup', () => {
    const dir = path.resolve(__dirname, '../../features/landing/components')
    for (const f of ['Navigation.tsx', 'HeroSection.tsx', 'OutreachSection.tsx', 'CTASection.tsx', 'Footer.tsx']) {
      expect(readFileSync(path.join(dir, f), 'utf8')).not.toMatch(/['"]\/signup/)
    }
  })
})
