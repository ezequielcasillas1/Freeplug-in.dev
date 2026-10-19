import { existsSync, readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(auth)/actions', () => ({ signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/cancel', useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
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

const LOCKED_FILE = process.env.FREEPLUG_LOCKED_COPY ?? '/workspace/freeplug-qa/freeplug-english-source-LOCKED-2026-09-24.txt'
describe.skipIf(!existsSync(LOCKED_FILE))('Cancel tab label matches the locked file (Sable 4:32 PM: "Cancel", was "Cancel plan")', () => {
  it('the locked entry for DashboardNav.tsx:11 is "Cancel", and so is the tab', () => {
    const lines = readFileSync(LOCKED_FILE, 'utf8').split('\n')
    const entry = lines.findLast((l) => l.startsWith('src/app/(dashboard)/DashboardNav.tsx:11  '))
    expect(entry?.match(/"([^"]*)"\s*$/)?.[1]).toBe('Cancel')
    expect(lines.some((l) => l.includes('4:32 PM CT (Sable): DashboardNav tab locked as "Cancel"'))).toBe(true)
    render(<DashboardNav />)
    expect(screen.getByRole('link', { name: 'Cancel' }).textContent).toBe('Cancel')
    expect(screen.queryByRole('link', { name: 'Cancel plan' })).toBeNull()
  })
})
