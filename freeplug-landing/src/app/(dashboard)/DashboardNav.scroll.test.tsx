import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/cancel' }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const { DashboardNav, hasMoreRight } = await import('./DashboardNav')

// jsdom has no layout: fake a 375 px tab bar (clientWidth 343) with 600 px of tabs.
function fakeLayout(nav: HTMLElement) {
  Object.defineProperty(nav, 'clientWidth', { configurable: true, value: 343 })
  Object.defineProperty(nav, 'scrollWidth', { configurable: true, value: 600 })
  nav.querySelectorAll<HTMLElement>('a').forEach((a, i) => {
    Object.defineProperty(a, 'offsetLeft', { configurable: true, value: i * 100 })
    Object.defineProperty(a, 'offsetWidth', { configurable: true, value: 80 })
  })
}

describe('dashboard tabs at 375 px: right-edge fade + active tab in view (Oct 13)', () => {
  const orig = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  afterEach(() => { if (orig) Object.defineProperty(HTMLElement.prototype, 'clientWidth', orig) })

  it('hasMoreRight is true only while content is hidden to the right', () => {
    expect(hasMoreRight({ scrollLeft: 0, clientWidth: 343, scrollWidth: 600 })).toBe(true)
    expect(hasMoreRight({ scrollLeft: 257, clientWidth: 343, scrollWidth: 600 })).toBe(false)
    expect(hasMoreRight({ scrollLeft: 0, clientWidth: 900, scrollWidth: 600 })).toBe(false)
  })

  it('scrolls the active tab (Cancel, last) into view, then the fade hides at the end and returns when scrolled back', () => {
    // Layout must exist before the effect runs: patch the prototype for the first render.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.tagName === 'NAV' ? 343 : 0 } })
    const { rerender } = render(<DashboardNav />)
    const nav = screen.getByRole('navigation')
    fakeLayout(nav)
    rerender(<DashboardNav />)
    act(() => { nav.scrollLeft = 0; fireEvent.scroll(nav) })
    expect(screen.getByTestId('dash-nav-fade').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByTestId('dash-nav-fade').className).toMatch(/pointer-events-none .*bg-gradient-to-l from-zinc-50/)
    act(() => { nav.scrollLeft = 257; fireEvent.scroll(nav) })
    expect(screen.queryByTestId('dash-nav-fade')).toBeNull()
  })

  it('on load, the active tab is centred when it starts off-screen', async () => {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>
    const saved = ['offsetLeft', 'offsetWidth', 'scrollWidth'].map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)] as const)
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.tagName === 'NAV' ? 343 : 0 } })
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get() { return this.tagName === 'NAV' ? 600 : 0 } })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return 80 } })
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', { configurable: true, get(this: HTMLElement) { return this.getAttribute('aria-current') === 'page' ? 520 : 0 } })
    try {
      render(<DashboardNav />)
      const nav = screen.getByRole('navigation')
      // 520 - (343 - 80) / 2 = 388.5
      expect(nav.scrollLeft).toBeCloseTo(388.5)
    } finally {
      for (const [k, d] of saved) if (d) Object.defineProperty(HTMLElement.prototype, k, d); else delete proto[k]
    }
  })
})
