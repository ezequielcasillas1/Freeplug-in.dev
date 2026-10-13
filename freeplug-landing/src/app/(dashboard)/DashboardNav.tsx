'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/plans', label: 'Plans' },
  { href: '/dashboard/request-website', label: 'Request website' },
  { href: '/dashboard/help', label: 'Help' },
  { href: '/dashboard/cancel', label: 'Cancel' },
] as const

export function DashboardNav() {
  const pathname = usePathname()

  // One row that scrolls sideways on narrow screens instead of wrapping (Lina, Sep 25). The
  // wrapper draws the bottom rule so the scroll area never clips the active underline.
  return (
    <div className="border-b border-zinc-200 mb-8">
      <nav
        className="-mb-px flex flex-nowrap gap-6 overflow-x-auto whitespace-nowrap text-sm"
        aria-label="Dashboard"
      >
        {items.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'shrink-0 pb-3 border-b-2 border-[#ba3d3d] font-semibold text-[#ba3d3d]'
                  : 'shrink-0 pb-3 border-b-2 border-transparent font-medium text-gray-600 hover:text-[#ba3d3d]'
              }
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
