// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import nextConfig from '../../../next.config'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { PREVIEW_HEADER_SOURCES, PREVIEW_RESPONSE_HEADERS } from './headers'

const enter = vi.fn(async (token: string) => token === 'good')
vi.mock('@/lib/outreach/server', () => ({ enterPreviewWithToken: (t: string) => enter(t) }))

describe('private preview headers', () => {
  it('next.config sends noindex, no-referrer and no-store on every preview and claim path', async () => {
    const rules = await nextConfig.headers!()
    expect(rules.map((r) => r.source)).toEqual([...PREVIEW_HEADER_SOURCES])
    for (const r of rules) {
      expect(Object.fromEntries(r.headers.map((h) => [h.key, h.value]))).toEqual(PREVIEW_RESPONSE_HEADERS)
    }
    expect(PREVIEW_RESPONSE_HEADERS['X-Robots-Tag']).toContain('noindex')
  })

  it('round 7 (Jace): the /claim layout (claim card, neutral page and its 404) carries robots noindex, and /claim + /claim/resend get X-Robots-Tag', async () => {
    const { metadata } = await import('@/app/claim/layout')
    expect(metadata.robots).toMatchObject({ index: false, follow: false })
    expect(PREVIEW_HEADER_SOURCES).toContain('/claim')
    expect(PREVIEW_HEADER_SOURCES).toContain('/claim/:path*')
  })

  it('robots.txt and the sitemap never mention the preview, claim or link paths', () => {
    const text = JSON.stringify([robots(), sitemap()])
    expect(text).not.toMatch(/\/preview|\/claim|\/p\//)
  })

  it('/p/<token> answers good and bad tokens the same way (303 to /preview, same headers)', async () => {
    const { GET } = await import('@/app/p/[token]/route')
    const answers = []
    for (const token of ['good', 'bad']) {
      const res = await GET(new Request(`http://localhost:3000/p/${token}`), { params: Promise.resolve({ token }) })
      answers.push({ status: res.status, location: res.headers.get('location'), robots: res.headers.get('x-robots-tag'), cache: res.headers.get('cache-control'), ref: res.headers.get('referrer-policy') })
    }
    expect(answers[0]).toEqual(answers[1])
    expect(answers[0]).toEqual({
      status: 303,
      location: 'http://localhost:3000/preview',
      robots: PREVIEW_RESPONSE_HEADERS['X-Robots-Tag'],
      cache: PREVIEW_RESPONSE_HEADERS['Cache-Control'],
      ref: 'no-referrer',
    })
  })
})
