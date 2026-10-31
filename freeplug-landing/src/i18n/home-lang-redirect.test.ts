import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { homeLangRedirect } from './home-lang-redirect'

const req = (u: string) => new NextRequest(new URL(u, 'http://localhost:3462'))

describe('homeLangRedirect (/?lang=es -> /es)', () => {
  it('redirects the home page with lang=es to /es, keeping other params', () => {
    const r = homeLangRedirect(req('/?lang=es&utm=x'), ['en', 'es'])!
    expect(r.status).toBe(307)
    expect(new URL(r.headers.get('location')!).pathname).toBe('/es')
    expect(new URL(r.headers.get('location')!).search).toBe('?utm=x')
  })
  it('leaves everything else alone', () => {
    expect(homeLangRedirect(req('/'), ['en', 'es'])).toBeNull()
    expect(homeLangRedirect(req('/?lang=en'), ['en', 'es'])).toBeNull()
    expect(homeLangRedirect(req('/faq?lang=es'), ['en', 'es'])).toBeNull()
    expect(homeLangRedirect(req('/login?lang=es'), ['en', 'es'])).toBeNull()
    expect(homeLangRedirect(req('/?lang=es'), ['en'])).toBeNull()
  })
})
