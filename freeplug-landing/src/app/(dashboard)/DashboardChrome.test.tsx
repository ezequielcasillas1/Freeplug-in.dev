import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(auth)/actions', () => ({ signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/cancel' }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const { DashboardHeader } = await import('./DashboardHeader')
const { DashboardNav } = await import('./DashboardNav')

describe('signed-in header (Lina, phone width)', () => {
  it('hides the email below 640px and keeps "Sign out" on one line', () => {
    render(<DashboardHeader email="owen-priority55-1790363909476@example.com" />)
    const email = screen.getByTestId('header-email')
    expect(email.className).toMatch(/(^| )hidden( |$)/)
    expect(email.className).toContain('sm:block')
    expect(email.className).toContain('truncate')
    expect(screen.getByRole('button', { name: 'Sign out' }).className).toContain('whitespace-nowrap')
    expect(screen.getByRole('link', { name: 'Freeplug' }).className).toContain('shrink-0')
  })
})

describe('dashboard tabs', () => {
  it('are one row that scrolls sideways (no wrap)', () => {
    render(<DashboardNav />)
    const nav = screen.getByRole('navigation', { name: 'Dashboard' })
    expect(nav.className).toContain('overflow-x-auto')
    expect(nav.className).toContain('flex-nowrap')
    expect(nav.className).not.toContain('flex-wrap ')
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('aria-current', 'page')
  })
})
