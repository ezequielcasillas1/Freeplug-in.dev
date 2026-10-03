import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * /claim (round 5 card, round 6 3-case rule). The claim-start card (Lina gap 1, Sable 1:46 AM)
 * names the business ONLY after the preview link checks out. Without a valid link (Jace, round 6):
 *   1. signed in with a saved claim -> the current step;
 *   2. signed in, no claim -> the neutral page (Sable 1:57 AM), identical in every case, status 200;
 *   3. signed out -> the notFound() 404, which never names a business.
 */
const h = vi.hoisted(() => ({
  user: { id: 'e2e00000-0000-4000-8000-000000000011' } as null | { id: string; email?: string; email_confirmed_at?: string | null },
  preview: null as null | { id: string; business_name: string },
  secFetchSite: 'cross-site' as string | null,
  previewLookups: 0,
  claimed: null as null | Record<string, unknown>,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(h.secFetchSite ? { 'sec-fetch-site': h.secFetchSite } : {}),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
  useRouter: () => ({ refresh: () => {} }),
}))
vi.mock('@/lib/outreach/server', () => ({
  currentPreviewSite: async () => {
    h.previewLookups++
    return h.preview
  },
  getClaimedSiteForUser: async () => h.claimed,
  customerPreviewPhotos: async () => [],
  getSiteDetails: async () => null,
  latestPreviewSubmission: async () => null,
  syncSetupSessionForUser: async () => {},
}))
vi.mock('./ClaimSteps', () => ({
  ClaimAddCardButton: () => null,
  ClaimDetailsStep: () => <div data-testid="step2-form" />,
  ClaimPlanStep: () => null,
  ClaimWaiting: () => null,
}))

import ClaimPage from './page'
import { verifyClaimStartToken } from './start/claim-redirect'

const SITE = { id: 'e2e00000-0000-4000-8000-0000000000a1', business_name: 'Gracia Lawn Care' }
const LINE = "Tap the button to start claiming it. You won't pay anything unless you pick a hosting plan and your site goes live."
const STALE = 'This page was open for a while, so we refreshed it. Tap Claim my website again to continue.'
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'local-test-service-role')
const submit = vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => {})

const page = (claim?: string, extra: Record<string, string> = {}) =>
  ClaimPage({ searchParams: Promise.resolve({ ...(claim ? { claim } : {}), ...extra }) as never })

describe('/claim claim-start card (Lina gap 1, Jace guard)', () => {
  beforeEach(() => {
    h.user = { id: 'e2e00000-0000-4000-8000-000000000011' }
    h.preview = SITE
    h.secFetchSite = 'cross-site'
    h.previewLookups = 0
    h.claimed = null
    submit.mockClear()
  })

  it('valid link, opened from another site: heading with the name, grey line, one red button, waits for the tap', async () => {
    render(await page())
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('We built this website for Gracia Lawn Care')
    expect(screen.getByTestId('claim-card-line')).toHaveTextContent(LINE)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Claim my website' })).toHaveAttribute('data-emphasis', 'red')
    expect(submit).not.toHaveBeenCalled()
  })

  it('the form token is for this user and this link', async () => {
    render(await page())
    const t = (document.querySelector('input[name="t"]') as HTMLInputElement).value
    expect(verifyClaimStartToken(t, h.user!.id)).toEqual({ status: 'ok', siteId: SITE.id })
    expect(verifyClaimStartToken(t, '99999999-2222-4333-8444-555555555555')).toEqual({ status: 'bad' })
  })

  it('opened from this site (after sign-up): same card, submits by itself', async () => {
    h.secFetchSite = 'same-origin'
    render(await page())
    expect(screen.getByTestId('claim-start-card')).toBeInTheDocument()
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('stale token (?claim=stale): the 1:45 line replaces the grey line, fresh token, no auto-submit even same-origin', async () => {
    h.secFetchSite = 'same-origin'
    render(await page('stale'))
    expect(screen.getByTestId('claim-card-line')).toHaveTextContent(STALE)
    expect(document.body.textContent).not.toContain(LINE)
    const t = (document.querySelector('input[name="t"]') as HTMLInputElement).value
    expect(verifyClaimStartToken(t, h.user!.id)).toEqual({ status: 'ok', siteId: SITE.id })
    expect(submit).not.toHaveBeenCalled()
  })

  it('an unknown ?claim value with a valid link: the card, never submitting by itself', async () => {
    h.secFetchSite = 'same-origin'
    render(await page('invalid'))
    expect(screen.getByTestId('claim-card-line')).toHaveTextContent(LINE)
    expect(submit).not.toHaveBeenCalled()
  })

  it('?claim=email_unconfirmed with a valid link: the card, no old one-line confirm box (round 7 amber box tests below)', async () => {
    render(await page('email_unconfirmed'))
    expect(screen.getByTestId('claim-start-card')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Check your email to confirm your account.')
  })

  it('signed out with no valid link: the 404; with one: on to sign-up (name not shown here either)', async () => {
    h.user = null
    h.preview = null
    await expect(page()).rejects.toThrow('NEXT_NOT_FOUND')
    h.preview = SITE
    await expect(page()).rejects.toThrow('NEXT_REDIRECT /signup?next=/claim')
  })
})

const NEUTRAL = {
  heading: 'Open your preview link on this device',
  body: 'To keep going, open the link from the message we sent you, on this phone or computer.',
  help: "Can't find it? Call or text us at 737-392-5612, or email support@freeplug-in.dev.",
  phone: "Can't find it? We can help.",
}

describe("/claim without a valid link: Jace's 3-case rule (round 6)", () => {
  beforeEach(() => {
    h.user = { id: 'e2e00000-0000-4000-8000-000000000011' }
    h.preview = null
    h.secFetchSite = 'cross-site'
    h.previewLookups = 0
    h.claimed = null
    submit.mockClear()
  })

  it('case 1: signed in with a saved claim -> the current step, with no link or a bad one, link never looked at', async () => {
    h.claimed = { id: SITE.id, business_name: 'Gracia Lawn Care', prefill: {}, services: [], service_sources: {}, publish_status: 'none', plan_hosting_cents: null }
    for (const claim of [undefined, 'stale', 'invalid', 'no_link']) {
      const { unmount } = render(await page(claim))
      expect(screen.getByTestId('step2-form')).toBeInTheDocument()
      expect(screen.queryByTestId('claim-neutral-card')).toBeNull()
      unmount()
    }
    expect(h.previewLookups).toBe(0)
  })

  it('case 2: signed in, no claim, no valid link -> the neutral page: wording, grey buttons, outline dashboard link, no red button, no business', async () => {
    const { container } = render(await page())
    const card = screen.getByTestId('claim-neutral-card')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(NEUTRAL.heading)
    expect(card).toHaveTextContent(NEUTRAL.body)
    expect(screen.getByTestId('neutral-help-desktop')).toHaveTextContent(NEUTRAL.help)
    expect(screen.getByTestId('neutral-help-desktop').className).toMatch(/\bhidden\b.*\bmd:block\b/)
    const phone = screen.getByTestId('neutral-help-phone')
    expect(phone.className).toContain('md:hidden')
    expect(phone.querySelector('p')).toHaveTextContent(NEUTRAL.phone)
    expect(phone.querySelector('p')!.className).toContain('text-gray-500')
    const links = Array.from(phone.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-label')])
    expect(links).toEqual([
      ['Call us', 'tel:+17373925612', 'Call 737-392-5612'],
      ['Text us', 'sms:+17373925612', 'Text 737-392-5612'],
      ['Email us', 'mailto:support@freeplug-in.dev', 'Email support@freeplug-in.dev'],
    ])
    for (const a of phone.querySelectorAll('a')) expect(a.className).toMatch(/min-h-\[44px\].*border-zinc-300/)
    const dash = screen.getByTestId('neutral-dashboard')
    expect(dash).toHaveTextContent('Go to my dashboard')
    expect(dash).toHaveAttribute('href', '/dashboard')
    // After the buttons.
    expect(phone.compareDocumentPosition(dash) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Round 7 (Lina): "Go to my dashboard" is the standard red OUTLINE secondary button; there is
    // no solid red button, no form, no business.
    expect(dash.className).toMatch(/\bborder-2\b/)
    expect(dash.className).toMatch(/\bborder-\[#ba3d3d\]/)
    expect(dash.className).toMatch(/\bbg-white\b/)
    expect(Array.from(container.querySelectorAll('*')).some((el) => el.classList.contains('bg-[#ba3d3d]'))).toBe(false)
    for (const a of phone.querySelectorAll('a')) expect(a.className).not.toContain('#ba3d3d')
    expect(container.querySelector('form, button')).toBeNull()
    expect(container.textContent).not.toMatch(/Gracia|We built this website/)
    expect(submit).not.toHaveBeenCalled()
  })

  it('case 2: the identical page whatever ?claim= says and however the link failed (the page gets no input from either)', async () => {
    const html: string[] = []
    for (const claim of [undefined, 'stale', 'no_link', 'invalid', 'email_unconfirmed', '<script>']) {
      for (const secFetchSite of ['cross-site', 'same-origin', null]) {
        h.secFetchSite = secFetchSite
        const { container, unmount } = render(await page(claim))
        html.push(container.innerHTML)
        unmount()
      }
    }
    expect(new Set(html).size).toBe(1)
    expect(html[0]).toContain(NEUTRAL.heading)
  })

  it('case 2 renders normally (status 200, no notFound or redirect thrown)', async () => {
    await expect(page()).resolves.toBeTruthy()
  })

  it('case 3: signed out with no valid link -> the 404 (never the neutral page)', async () => {
    h.user = null
    for (const claim of [undefined, 'stale', 'no_link']) await expect(page(claim)).rejects.toThrow('NEXT_NOT_FOUND')
  })
})

const OWN = 'unconfirmed-r7@local.test'
const BOX_LINE = `First, confirm your email. Open the email we sent to ${OWN} and tap the link inside.`

describe('confirm-email box on /claim (round 7)', () => {
  beforeEach(() => {
    h.user = { id: 'e2e00000-0000-4000-8000-000000000021', email: OWN, email_confirmed_at: null }
    h.preview = null
    h.secFetchSite = 'same-origin'
    h.previewLookups = 0
    h.claimed = null
    submit.mockClear()
  })

  it('neutral page, unconfirmed: amber box at the TOP of the card naming the signed-in user\'s own email', async () => {
    render(await page())
    const card = screen.getByTestId('claim-neutral-card')
    const box = screen.getByTestId('confirm-email-box')
    expect(card.firstElementChild).toBe(box)
    expect(box).toHaveTextContent(BOX_LINE)
    expect(screen.getByTestId('resend-link')).toHaveTextContent('Send it again')
    expect(card).toHaveTextContent('Open your preview link on this device')
  })

  it('the email never comes from the query string or link: ?email= and ?account_email= are ignored', async () => {
    render(await page(undefined, { email: 'attacker@evil.example', account_email: 'attacker@evil.example' }))
    expect(document.body.textContent).not.toContain('attacker@evil.example')
    expect(screen.getByTestId('confirm-email-box')).toHaveTextContent(OWN)
  })

  it('confirmed account: no box', async () => {
    h.user = { id: 'e2e00000-0000-4000-8000-000000000021', email: OWN, email_confirmed_at: '2026-09-27T07:00:00Z' }
    render(await page())
    expect(screen.getByTestId('claim-neutral-card')).toBeInTheDocument()
    expect(screen.queryByTestId('confirm-email-box')).toBeNull()
  })

  it('neutral page with the box is still identical across link cases and ?claim= values for the same user', async () => {
    const html: string[] = []
    for (const claim of [undefined, 'stale', 'no_link', 'invalid', 'email_unconfirmed']) {
      const { container, unmount } = render(await page(claim))
      html.push(container.innerHTML)
      unmount()
    }
    expect(new Set(html).size).toBe(1)
  })

  it('valid link + ?claim=email_unconfirmed: the claim card with the amber box on top, never auto-submitting', async () => {
    h.preview = SITE
    render(await page('email_unconfirmed'))
    const card = screen.getByTestId('claim-start-card')
    expect(card.firstElementChild).toBe(screen.getByTestId('confirm-email-box'))
    expect(screen.getByTestId('confirm-email-box')).toHaveTextContent(BOX_LINE)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('We built this website for Gracia Lawn Care')
    expect(submit).not.toHaveBeenCalled()
  })

  it('valid link, unconfirmed, opened from this site: box shown and no automatic claim POST (it would only be refused)', async () => {
    h.preview = SITE
    render(await page())
    expect(screen.getByTestId('confirm-email-box')).toBeInTheDocument()
    expect(submit).not.toHaveBeenCalled()
  })

  it('signed out: the 404, never a box or an email', async () => {
    h.user = null
    await expect(page(undefined, { email: OWN })).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
