import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { TechStackSection, techStack } from './TechStackSection'

// framer-motion's whileInView needs IntersectionObserver, which jsdom lacks.
beforeAll(() => {
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    class IO {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    globalThis.IntersectionObserver = IO as unknown as typeof IntersectionObserver
  }
})

const NAMES = ['Envato template', 'HTML & CSS', 'Bootstrap 5', 'Cloudflare', 'Cloudflare Turnstile', 'Resend']

describe('TechStackSection (local business stack, Oct 3)', () => {
  it("lists the six tiles in Lina's order with Sable's names", () => {
    expect(techStack.map((t) => t.name)).toEqual(NAMES)
    render(<TechStackSection />)
    const tiles = screen.getAllByTestId('tech-tile')
    expect(tiles).toHaveLength(6)
    expect(tiles.map((t) => t.querySelector('span')?.textContent)).toEqual(NAMES)
  })

  it('always renders each name (no hover-only, hidden or transparent label) with an svg icon, no emoji', () => {
    render(<TechStackSection />)
    for (const tile of screen.getAllByTestId('tech-tile')) {
      const name = tile.querySelector('span')!
      expect(name.className).not.toMatch(/(^|\s)(hidden|invisible|opacity-0|sr-only)(\s|$)/)
      expect(name.getAttribute('style') ?? '').not.toMatch(/opacity:\s*0/)
      expect(tile.querySelector('svg')).not.toBeNull()
      expect(tile.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })

  it('shows each tile line on desktop only', () => {
    render(<TechStackSection />)
    const tiles = screen.getAllByTestId('tech-tile')
    techStack.forEach((t, i) => {
      const line = within(tiles[i]).getByText(t.description)
      expect(line.className).toMatch(/(^|\s)hidden(\s|$)/)
      expect(line.className).toMatch(/(^|\s)lg:block(\s|$)/)
    })
  })

  it('lays out 3 tiles per row on phones', () => {
    render(<TechStackSection />)
    expect(screen.getByTestId('tech-stack-tiles').className).toMatch(/(^|\s)grid-cols-3(\s|$)/)
  })

  it('has no rotate class and no hover rotate on the tiles', () => {
    render(<TechStackSection />)
    expect(screen.getByTestId('tech-stack-tiles').outerHTML).not.toMatch(/rotate-/)
    const src = readFileSync(join(__dirname, 'TechStackSection.tsx'), 'utf8')
    expect(src).not.toMatch(/whileHover=\{\{[^}]*rotate/)
  })

  it("uses Sable's heading, intro and feature cards, and keeps the Performance panel", () => {
    render(<TechStackSection />)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2).toHaveTextContent('Built On Proven Tools')
    expect(within(h2).getByText('Proven Tools').className).toMatch(/from-\[#ba3d3d\]/)
    expect(
      screen.getByText(
        /^Every local business site we build uses the same setup: lightweight pages, a layout that works on\s+phones, a quote form that filters out spam, and a secure https address\.$/,
      ),
    ).toBeInTheDocument()
    for (const [title, line] of [
      ['Fast Loading', "Lightweight pages served from Cloudflare's network."],
      ['Mobile First', 'A responsive layout that adjusts to phones, tablets and computers.'],
      ['SEO Basics Included', 'Clear page titles, descriptions and business details that search engines can read.'],
      ['Secure Connection', "HTTPS on every page through Cloudflare's SSL."],
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
      expect(screen.getByText(line)).toBeInTheDocument()
    }
    expect(screen.queryByText(/Modern Tech|cutting-edge|future-proof|Sub-second|rank higher/)).toBeNull()
    expect(screen.getByRole('heading', { level: 3, name: 'Performance That Matters' })).toBeInTheDocument()
  })
})
