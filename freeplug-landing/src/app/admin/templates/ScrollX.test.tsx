import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScrollX, STICKY_FIRST_TD, STICKY_FIRST_TH } from './ScrollX'

describe('ScrollX (375 px: wide admin tables scroll inside, page stays viewport-wide)', () => {
  it('wraps content in an overflow-x-auto box with a right-edge fade', () => {
    render(<ScrollX testId="t"><table><tbody><tr><td>x</td></tr></tbody></table></ScrollX>)
    const box = screen.getByTestId('t')
    expect(box.className).toContain('max-w-full')
    expect(box.firstElementChild!.className).toContain('overflow-x-auto')
    const fade = screen.getByTestId('scroll-x-fade')
    expect(fade.getAttribute('aria-hidden')).toBe('true')
    expect(fade.className).toMatch(/pointer-events-none/)
    expect(fade.className).toMatch(/bg-gradient-to-l from-white/)
  })
  it('sticky name column has an opaque background', () => {
    expect(STICKY_FIRST_TH).toMatch(/sticky left-0 .*bg-zinc-50/)
    expect(STICKY_FIRST_TD).toMatch(/sticky left-0 .*bg-white/)
  })
  it('every table on the templates, widen-log and digest pages sits inside ScrollX', () => {
    for (const f of ['page.tsx', 'widen-log/page.tsx', 'digest/page.tsx']) {
      const src = readFileSync(path.join(__dirname, f), 'utf8')
      const tables = src.match(/<table\b/g)?.length ?? 0
      expect(tables, f).toBeGreaterThan(0)
      expect(src.match(/<ScrollX\b/g)?.length, f).toBe(tables)
      expect(src.match(/<\/ScrollX>/g)?.length, f).toBe(tables)
      expect(src, f).toContain('STICKY_FIRST_TD')
    }
  })
})
