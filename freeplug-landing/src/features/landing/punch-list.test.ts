import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Wren's punch list (Owen items): jump links, dummy reviews, titles, favicon/starter assets, 404. */
const ROOT = join(__dirname, '..', '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const COMPONENTS = 'src/features/landing/components'

/** ids rendered on the home page: every landing component that src/app/page.tsx renders. */
function homeIds(): Set<string> {
  const page = read('src/app/page.tsx')
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
    expect(read('src/app/faq/page.tsx')).not.toMatch(/href=["'{`]+#/)
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
    expect(src).toContain('Real reviews coming soon.')
    expect(src).toContain('id="reviews"')
  })
})

describe('titles (G2)', () => {
  it.each([
    ['src/app/page.tsx'],
    ['src/app/faq/layout.tsx'],
    ['src/app/(auth)/login/page.tsx'],
    ['src/app/(auth)/signup/page.tsx'],
    ['src/app/(auth)/forgot-password/page.tsx'],
    ['src/app/(auth)/reset-password/page.tsx'],
    ['src/app/request-website/page.tsx'],
    ['src/app/(dashboard)/dashboard/request-website/page.tsx'],
    ['src/app/not-found.tsx'],
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
  const src = read('src/app/not-found.tsx')
  it('has the neutral heading and a link home', () => {
    expect(src).toContain("'Page not found'")
    expect(src).toContain("'Go to the homepage'")
    expect(src).toMatch(/<Link\s+href="\/"/)
  })
})
