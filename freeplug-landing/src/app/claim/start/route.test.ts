import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  user: null as null | { id: string },
  outcome: { ok: true } as unknown,
  claimCalls: 0,
  preview: null as null | { id: string; business_name: string },
  claimed: null as null | { id: string },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('@/lib/outreach/server', () => ({
  claimPreviewSiteForUser: async () => {
    h.claimCalls++
    return h.outcome
  },
  currentPreviewSite: async () => h.preview,
  getClaimedSiteForUser: async () => h.claimed,
}))

import * as route from './route'
import { claimRedirectPath, claimStartToken, isSameOriginPost, liveClaimRedirect, shouldAutoClaim, verifyClaimStartToken } from './claim-redirect'

const { POST } = route
const UID = 'e2e00000-0000-4000-8000-000000000011'
const SITE = 'e2e00000-0000-4000-8000-0000000000a1'
const OTHER_SITE = 'e2e00000-0000-4000-8000-0000000000b2'
const OTHER_USER = '99999999-2222-4333-8444-555555555555'
const PREVIEW = { id: SITE, business_name: 'Gracia Lawn Care' }
const MIN = 60_000
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'local-test-service-role')
type ReqOpts = { origin?: string | null; site?: string | null; token?: string | null }
const req = ({ origin = 'https://freeplug-in.dev', site = 'same-origin', token }: ReqOpts = {}) => {
  const headers = new Headers()
  if (origin) headers.set('origin', origin)
  if (site) headers.set('sec-fetch-site', site)
  const body = new FormData()
  const t = token === undefined ? claimStartToken(UID, SITE) : token
  if (t !== null) body.set('t', t)
  return new Request('https://freeplug-in.dev/claim/start', { method: 'POST', headers, body }) as never
}

describe('/claim/start (Vera QA #1)', () => {
  beforeEach(() => {
    h.user = { id: UID }
    h.outcome = { ok: true, site: {} }
    h.claimCalls = 0
    h.preview = PREVIEW
    h.claimed = null
  })

  it('claims, then sends the browser to /claim on a fresh request', async () => {
    const res = await POST(req())
    expect(h.claimCalls).toBe(1)
    expect(res.status).toBe(303)
    expect(new URL(res.headers.get('location')!).pathname + new URL(res.headers.get('location')!).search).toBe('/claim')
    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('signed out: goes to sign-up without claiming', async () => {
    h.user = null
    const res = await POST(req())
    expect(h.claimCalls).toBe(0)
    expect(res.headers.get('location')).toBe('https://freeplug-in.dev/signup?next=/claim')
  })

  it('maps each outcome to where /claim shows it', () => {
    expect(claimRedirectPath({ ok: true, site: {} } as never)).toBe('/claim')
    expect(claimRedirectPath({ ok: false, reason: 'no_link' } as never)).toBe('/claim?claim=no_link')
    expect(claimRedirectPath({ ok: false, reason: 'email_unconfirmed' } as never)).toBe('/claim?claim=email_unconfirmed')
    expect(claimRedirectPath({ ok: false, reason: 'claimed_by_other' } as never)).toBe('/claim?claim=invalid')
    expect(claimRedirectPath({ ok: false, reason: 'link_invalid' } as never)).toBe('/claim?claim=invalid')
  })
})

describe('/claim/start is a same-site POST only (Vera r2 bug 9)', () => {
  beforeEach(() => {
    h.user = { id: UID }
    h.outcome = { ok: true, site: {} }
    h.claimCalls = 0
    h.preview = PREVIEW
    h.claimed = null
  })

  it('exports no GET (Next answers 405), only POST', () => {
    expect('GET' in route).toBe(false)
    expect(typeof route.POST).toBe('function')
  })

  it('a POST from another site gets 403 and claims nothing', async () => {
    for (const r of [req({ origin: 'https://evil.example', site: 'cross-site' }), req({ origin: 'https://evil.example', site: null }), req({ origin: null, site: 'cross-site' }), req({ origin: 'null', site: 'same-site' })]) {
      const res = await POST(r)
      expect(res.status).toBe(403)
      expect(res.headers.get('location')).toBeNull()
    }
    expect(h.claimCalls).toBe(0)
  })

  it('without the signed-in user\'s form token: 403 (covers browsers that send neither header)', async () => {
    expect((await POST(req({ origin: null, site: null, token: null }))).status).toBe(403)
    expect((await POST(req({ token: 'garbage' }))).status).toBe(403)
    expect((await POST(req({ token: claimStartToken(OTHER_USER, SITE) }))).status).toBe(403)
    expect(h.claimCalls).toBe(0)
  })

  it('the claim pages send "Origin: null" (Referrer-Policy: no-referrer): same-origin fetch metadata + token claims', async () => {
    const res = await POST(req({ origin: 'null', site: 'same-origin' }))
    expect(res.status).toBe(303)
    expect(h.claimCalls).toBe(1)
  })

  it('an old browser with neither header but a valid token still claims', async () => {
    const res = await POST(req({ origin: null, site: null }))
    expect(res.status).toBe(303)
    expect(h.claimCalls).toBe(1)
  })

  it('isSameOriginPost: NEXT_PUBLIC_APP_URL counts as this site; look-alikes and http do not', () => {
    expect(isSameOriginPost('http://localhost:3316', null, 'http://127.0.0.1:3316/claim/start', 'http://localhost:3316')).toBe(true)
    expect(isSameOriginPost('http://localhost:3316', 'same-origin', 'http://localhost:3316/claim/start', 'not a url')).toBe(true)
    expect(isSameOriginPost('https://freeplug-in.dev.evil.example', null, 'https://freeplug-in.dev/claim/start', 'https://freeplug-in.dev')).toBe(false)
    expect(isSameOriginPost('http://freeplug-in.dev', null, 'https://freeplug-in.dev/claim/start', 'https://freeplug-in.dev')).toBe(false)
    expect(isSameOriginPost('https://freeplug-in.dev', 'cross-site', 'https://freeplug-in.dev/claim/start', 'https://freeplug-in.dev')).toBe(false)
  })

  it('form tokens are bound to the user and the site and expire after 15 minutes', () => {
    const t0 = Date.parse('2026-09-27T06:00:00Z')
    const uid = '11111111-2222-4333-8444-555555555555'
    const t = claimStartToken(uid, SITE, t0)
    expect(verifyClaimStartToken(t, uid, t0 + MIN)).toEqual({ status: 'ok', siteId: SITE })
    expect(verifyClaimStartToken(t, '11111111-2222-4333-8444-555555555556', t0)).toEqual({ status: 'bad' })
    expect(verifyClaimStartToken(t, uid, t0 + 15 * MIN + 1)).toEqual({ status: 'expired', siteId: SITE })
    expect(verifyClaimStartToken(t, '11111111-2222-4333-8444-555555555556', t0 + 15 * MIN + 1)).toEqual({ status: 'bad' })
    expect(verifyClaimStartToken(123, uid, t0)).toEqual({ status: 'bad' })
    // Changing the site id or the expiry breaks the signature (no extending a token by hand).
    const [, exp, sig] = t.split('.')
    expect(verifyClaimStartToken(`${OTHER_SITE}.${exp}.${sig}`, uid, t0)).toEqual({ status: 'bad' })
    expect(verifyClaimStartToken(`${SITE}.${Number(exp) + 60 * MIN}.${sig}`, uid, t0 + 16 * MIN)).toEqual({ status: 'bad' })
    expect(verifyClaimStartToken(`${SITE}.${exp}`, uid, t0)).toEqual({ status: 'bad' })
    expect(verifyClaimStartToken('x'.repeat(201), uid, t0)).toEqual({ status: 'bad' })
  })

  it('no secret configured: every token is bad (fails closed)', () => {
    const t = claimStartToken(UID, SITE)
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    try {
      expect(verifyClaimStartToken(t, UID)).toEqual({ status: 'bad' })
    } finally {
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'local-test-service-role')
    }
  })

  it('/claim submits the claim form by itself only when opened from this site or typed in', () => {
    expect(shouldAutoClaim('same-origin')).toBe(true)
    expect(shouldAutoClaim('none')).toBe(true)
    expect(shouldAutoClaim('cross-site')).toBe(false)
    expect(shouldAutoClaim('same-site')).toBe(false)
    expect(shouldAutoClaim(null)).toBe(false)
  })
})

describe('/claim once the site is live (Vera r3 NEW-3)', () => {
  it('goes to /dashboard only when publish_status is live', () => {
    expect(liveClaimRedirect({ publish_status: 'live' })).toBe('/dashboard')
    for (const st of ['none', 'processing', 'failed', null, undefined]) expect(liveClaimRedirect({ publish_status: st })).toBeNull()
  })
})

describe('stale claim token (Sable 1:45 AM, round 5)', () => {
  const stale = (user = UID, site = SITE) => claimStartToken(user, site, Date.now() - 16 * MIN)
  const where = (res: Response) => {
    const u = new URL(res.headers.get('location')!)
    return u.pathname + u.search
  }
  beforeEach(() => {
    h.user = { id: UID }
    h.outcome = { ok: true, site: {} }
    h.claimCalls = 0
    h.preview = PREVIEW
    h.claimed = null
  })

  it('same-site, signed in, own expired token, valid unclaimed link: back to the card with a fresh token, no claim, no 403', async () => {
    for (const r of [req({ token: stale() }), req({ origin: 'null', site: 'same-origin', token: stale() }), req({ origin: null, site: null, token: stale() })]) {
      const res = await POST(r)
      expect(res.status).toBe(303)
      expect(where(res)).toBe('/claim?claim=stale')
      expect(res.headers.get('cache-control')).toContain('no-store')
    }
    expect(h.claimCalls).toBe(0)
  })

  it('cross-site POST with an expired token: plain 403', async () => {
    for (const r of [req({ origin: 'https://evil.example', site: 'cross-site', token: stale() }), req({ origin: null, site: 'cross-site', token: stale() }), req({ origin: 'https://evil.example', site: null, token: stale() })]) {
      const res = await POST(r)
      expect(res.status).toBe(403)
      expect(res.headers.get('location')).toBeNull()
    }
    expect(h.claimCalls).toBe(0)
  })

  it('bad or forged tokens, fresh or expired: plain 403', async () => {
    const t = stale()
    const [, exp, sig] = t.split('.')
    for (const token of [null, '', 'garbage', `${SITE}.${exp}.${sig.slice(0, -2)}xx`, `${SITE}.${Number(exp) + 30 * MIN}.${sig}`, `${SITE}.${exp}`]) {
      const res = await POST(req({ token }))
      expect(res.status, String(token)).toBe(403)
    }
    expect(h.claimCalls).toBe(0)
  })

  it('tokens swapped between users: 403 whether fresh or expired', async () => {
    for (const token of [claimStartToken(OTHER_USER, SITE), stale(OTHER_USER, SITE)]) {
      expect((await POST(req({ token }))).status).toBe(403)
    }
    expect(h.claimCalls).toBe(0)
  })

  it('tokens swapped between sites (the preview cookie is for another link): 403 whether fresh or expired', async () => {
    const [, exp, sig] = stale().split('.')
    for (const token of [claimStartToken(UID, OTHER_SITE), stale(UID, OTHER_SITE), `${OTHER_SITE}.${exp}.${sig}`]) {
      expect((await POST(req({ token }))).status).toBe(403)
    }
    expect(h.claimCalls).toBe(0)
  })

  it('expired token but no valid link (expired, revoked, claimed by someone else, or none): to /claim, which shows the saved step or the neutral page; nothing claimed', async () => {
    h.preview = null
    const res = await POST(req({ token: stale() }))
    expect(res.status).toBe(303)
    expect(where(res)).toBe('/claim')
    expect(h.claimCalls).toBe(0)
  })

  it('expired token after this user already claimed (e.g. in another tab): straight on to /claim, no second claim', async () => {
    h.preview = null
    h.claimed = { id: SITE }
    const res = await POST(req({ token: stale() }))
    expect(res.status).toBe(303)
    expect(where(res)).toBe('/claim')
    expect(h.claimCalls).toBe(0)
  })

  it('no valid link: a bad or other-user token is still a plain 403, not a redirect', async () => {
    h.preview = null
    for (const token of ['garbage', stale(OTHER_USER, SITE), claimStartToken(OTHER_USER, SITE)]) {
      const res = await POST(req({ token }))
      expect(res.status).toBe(403)
      expect(res.headers.get('location')).toBeNull()
    }
    expect(h.claimCalls).toBe(0)
  })

  it('signed out with an expired token: sign-up, nothing claimed', async () => {
    h.user = null
    const res = await POST(req({ token: stale() }))
    expect(where(res)).toBe('/signup?next=/claim')
    expect(h.claimCalls).toBe(0)
  })

  it('a fresh token still claims in one POST', async () => {
    const res = await POST(req())
    expect(where(res)).toBe('/claim')
    expect(h.claimCalls).toBe(1)
  })
})
