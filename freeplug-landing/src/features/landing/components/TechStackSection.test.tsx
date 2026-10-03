import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  techTileAtRest,
  techTileNoStagger,
  techTileStagger,
  techTileVariants,
} from '../animations/landing.variants'
import { TechStackSection, techStack } from './TechStackSection'

const reducedMotion = vi.hoisted(() => ({ value: false as boolean | null }))
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return { ...actual, useReducedMotion: () => reducedMotion.value }
})
afterEach(() => {
  reducedMotion.value = false
})

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

  it("Envato tile: Sable's shortened line (copy file freeplug-landing-tech-stack-copy-2026-10-03.md, Oct 3, 3:10 PM), no price or cost", () => {
    const envato = techStack.find((t) => t.name === 'Envato template')!
    expect(envato.description).toBe('Premium templates our developers can access, enhanced with your details.')
    expect(envato.description).not.toMatch(/\$|\d|price|cost|free|licen[cs]/i)
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

  it('adds a 24px row gap on phones and keeps the column gap and desktop gap', () => {
    render(<TechStackSection />)
    const cls = screen.getByTestId('tech-stack-tiles').className.split(/\s+/)
    expect(cls).toEqual(expect.arrayContaining(['gap-x-4', 'gap-y-6', 'sm:gap-6', 'md:grid-cols-6']))
    expect(cls).not.toContain('gap-4')
  })

  it('enters with a fade-up only: no rotate or scale in the tile entry variants', () => {
    const entry = { techTileVariants, techTileStagger, techTileAtRest, techTileNoStagger }
    for (const [name, variants] of Object.entries(entry)) {
      for (const state of ['hidden', 'visible'] as const) {
        const v = variants[state] as Record<string, unknown>
        for (const key of ['rotate', 'rotateX', 'rotateY', 'rotateZ', 'scale', 'scaleX', 'scaleY']) {
          expect(v, `${name}.${state}.${key}`).not.toHaveProperty(key)
        }
      }
    }
    expect(techTileVariants.hidden).toMatchObject({ opacity: 0, y: 30 })
    expect(techTileVariants.visible).toMatchObject({ opacity: 1, y: 0 })
    const stagger = (techTileStagger.visible as { transition: { staggerChildren: number } }).transition
    expect(stagger.staggerChildren).toBeGreaterThan(0)
    expect(stagger.staggerChildren).toBeLessThanOrEqual(0.1)
    const src = readFileSync(join(__dirname, 'TechStackSection.tsx'), 'utf8')
    expect(src).not.toMatch(/techLogoVariants/)
    expect(src).toMatch(/variants=\{reduceMotion \? techTileAtRest : techTileVariants\}/)
  })

  it('starts the tiles hidden (fade-up pending) when motion is allowed', () => {
    reducedMotion.value = false
    render(<TechStackSection />)
    expect(screen.getByTestId('tech-stack-tiles')).not.toHaveAttribute('data-reduced-motion')
    for (const tile of screen.getAllByTestId('tech-tile')) {
      expect(tile.getAttribute('style') ?? '').toMatch(/opacity:\s*0/)
      expect(tile.getAttribute('style') ?? '').not.toMatch(/rotate|scale/)
    }
  })

  it('shows the tiles at rest with prefers-reduced-motion (no entrance, no hover scale)', () => {
    reducedMotion.value = true
    render(<TechStackSection />)
    expect(screen.getByTestId('tech-stack-tiles')).toHaveAttribute('data-reduced-motion', 'true')
    for (const tile of screen.getAllByTestId('tech-tile')) {
      const style = tile.getAttribute('style') ?? ''
      expect(style).not.toMatch(/opacity:\s*0(?![.\d])/)
      expect(style).not.toMatch(/translateY\((?!0)|rotate|scale/)
    }
    const src = readFileSync(join(__dirname, 'TechStackSection.tsx'), 'utf8')
    expect(src).toMatch(/whileHover=\{reduceMotion \? undefined/)
    // At rest means the same values in both states, applied instantly.
    expect(techTileAtRest.hidden).toMatchObject({ opacity: 1, y: 0, transition: { duration: 0 } })
    expect(techTileAtRest.visible).toMatchObject({ opacity: 1, y: 0, transition: { duration: 0 } })
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
