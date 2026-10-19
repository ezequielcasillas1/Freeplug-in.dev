import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Wren's punch list (Owen items): jump links, dummy reviews, titles, favicon/starter assets, 404. */
const ROOT = join(__dirname, '..', '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const COMPONENTS = 'src/features/landing/components'
/** Spanish build (card C1): public copy lives in messages/en.json, the English lock. */
const EN = JSON.parse(read('messages/en.json'))
const enValue = (key: string): string => key.split('.').reduce((o, k) => o?.[k], EN) as unknown as string

/** ids rendered on the home page: every landing component that src/app/[locale]/page.tsx renders. */
function homeIds(): Set<string> {
  const page = read('src/app/[locale]/page.tsx')
  const rendered = [...page.matchAll(/<([A-Z][A-Za-z]+)[\s/>]/g)].map((m) => m[1])
  const ids = new Set<string>()
  for (const name of rendered) {
    const file = `${COMPONENTS}/${name}.tsx`
    if (!existsSync(join(ROOT, file))) continue
    for (const m of read(file).matchAll(/\sid="([^"]+)"/g)) ids.add(m[1])
  }
  return ids
}

describe('jump links (G6, G7, G8, H3)', () => {
  const hrefs = (rel: string) => [...read(rel).matchAll(/href:\s*'([^']*#[^']*)'/g)].map((m) => m[1])

  it('nav and footer hash links use a leading "/" so they work from /faq and other pages', () => {
    const all = [...hrefs(`${COMPONENTS}/Navigation.tsx`), ...hrefs(`${COMPONENTS}/Footer.tsx`)]
    expect(all.length).toBeGreaterThan(0)
    for (const h of all) expect(h, h).toMatch(/^\/#[a-z-]+$/)
  })

  it('every nav / footer / hero hash target exists on the home page', () => {
    const ids = homeIds()
    const targets = [
      ...hrefs(`${COMPONENTS}/Navigation.tsx`),
      ...hrefs(`${COMPONENTS}/Footer.tsx`),
      ...[...read(`${COMPONENTS}/HeroSection.tsx`).matchAll(/href="\/?#([a-z-]+)"/g)].map((m) => `/#${m[1]}`),
    ].map((h) => h.split('#')[1])
    expect(targets).toContain('outreach')
    expect(targets).toContain('hosting-plans')
    for (const id of targets) expect(ids, `#${id}`).toContain(id)
  })

  it('no bare "#..." hrefs on non-home pages (e.g. /faq)', () => {
    expect(read('src/app/[locale]/faq/page.tsx')).not.toMatch(/href=["'{`]+#/)
  })
})

describe('reviews section (R2, R3)', () => {
  const src = read(`${COMPONENTS}/ReviewsSection.tsx`)
  it('dummy "Coming Soon / Hover to preview" cards are gone', () => {
    expect(src).not.toMatch(/Hover to preview/)
    expect(src).not.toMatch(/>Coming Soon</)
    expect(src).not.toMatch(/placeholderReviews/)
  })
  it('keeps the honest "Real reviews coming soon." line and heading', () => {
    expect(enValue('public.landing.reviews.realReviewsComingSoonFreeplug')).toContain('Real reviews coming soon.')
    expect(src).toContain("t.rich('realReviewsComingSoonFreeplug'")
    expect(src).toContain('id="reviews"')
  })
})

describe('titles (G2)', () => {
  // Public pages moved under [locale] and read their titles from en.json (per-locale metadata).
  it.each([
    ['src/app/[locale]/page.tsx', 'public.meta.homeTitle'],
    ['src/app/[locale]/faq/layout.tsx', 'public.meta.faqTitle'],
    ['src/app/[locale]/signup/page.tsx', 'auth.signup.metaTitle'],
    ['src/app/[locale]/request-website/page.tsx', 'public.meta.requestWebsiteTitle'],
    ['src/app/not-found.tsx', 'public.notFound.metaTitle'],
    // Signed-in dashboard (Spanish build): titles come from dashboard.meta.*.
    ['src/app/(dashboard)/dashboard/request-website/page.tsx', 'dashboard.meta.requestWebsiteTitle'],
    ['src/app/(dashboard)/layout.tsx', 'dashboard.meta.dashboardTitle'],
    ['src/app/(dashboard)/dashboard/domain/page.tsx', 'dashboard.meta.domainTitle'],
    ['src/app/(dashboard)/dashboard/photos/page.tsx', 'dashboard.meta.photosTitle'],
    ['src/app/(dashboard)/dashboard/website/page.tsx', 'dashboard.meta.websiteTitle'],
  ])('%s sets its own "… | Freeplug" title from en.json (%s)', (rel, key) => {
    expect(enValue(key)).toMatch(/^[^|]+ \| Freeplug$/)
    const leaf = key.split('.').pop()!
    expect(read(rel)).toMatch(new RegExp(`'${leaf}'|${key.replace(/\./g, '\\.')}`))
  })
  it.each([
    ['src/app/(auth)/login/page.tsx'],
    ['src/app/(auth)/forgot-password/page.tsx'],
    ['src/app/(auth)/reset-password/page.tsx'],
  ])('%s sets its own "… | Freeplug" title', (rel) => {
    expect(read(rel)).toMatch(/title[:=]?\s*'[^']+ \| Freeplug'|const title = '[^']+ \| Freeplug'/)
  })
})

describe('favicon and starter assets (assets notes)', () => {
  it('icon.svg is the Freeplug mark (brand red tile)', () => {
    const svg = read('src/app/icon.svg')
    expect(svg).toContain('#ba3d3d')
    expect(svg).toContain('#8a2e2e')
  })
  it('favicon.ico is a real ICO and not the stock Next.js one (25,931 bytes)', () => {
    const ico = readFileSync(join(ROOT, 'src/app/favicon.ico'))
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(1)
    expect(ico.length).not.toBe(25931)
  })
  it.each(['file.svg', 'globe.svg', 'next.svg', 'vercel.svg', 'window.svg', 'grid.svg'])(
    'unused starter file public/%s is removed',
    (f) => {
      expect(existsSync(join(ROOT, 'public', f))).toBe(false)
    }
  )
})

describe('404 page (G16)', () => {
  // Spanish build: one NotFoundView for / and /es (copy in en.json public.notFound).
  const src = read('src/app/NotFoundView.tsx')
  it('has the neutral heading and a link home', () => {
    expect(enValue('public.notFound.heading')).toBe('Page not found')
    expect(enValue('public.notFound.link')).toBe('Go to the homepage')
    expect(src).toContain("t('heading')")
    expect(src).toContain("localizedPath('/', locale)")
    expect(src).toMatch(/<Link\s+href=\{homeHref\}/)
    expect(read('src/app/not-found.tsx')).toContain("locale=\"en\"")
  })
})
