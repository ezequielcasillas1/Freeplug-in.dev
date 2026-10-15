// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LINK_EXPIRED_MESSAGE } from '@/lib/auth/link-expired'
import LinkExpiredPage from './page'

const render = async (forWhat?: string) =>
  renderToStaticMarkup(await LinkExpiredPage({ searchParams: Promise.resolve(forWhat ? { for: forWhat } : {}) }))

describe('/link-expired', () => {
  it('shows the exact neutral copy', () => expect(LINK_EXPIRED_MESSAGE).toBe('This link has expired. Request a new one.'))
  it.each([
    ['reset', '/forgot-password'],
    ['claim', '/login?next=/claim'],
    ['account', '/login'],
    [undefined, '/login'],
    ['https://evil.example', '/login'],
  ])('for=%s links back to %s', async (forWhat, href) => {
    const html = await render(forWhat)
    expect(html).toContain(LINK_EXPIRED_MESSAGE)
    expect(html).toContain(`href="${href}"`)
    expect(html).not.toContain('evil')
  })
})
