'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/plans', label: 'Plans' },
  { href: '/dashboard/request-website', label: 'Request website' },
  { href: '/dashboard/cancel', label: 'Cancel' },
] as const

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav
      className="flex flex-wrap gap-6 text-sm border-b border-zinc-200 pb-3 mb-8"
      aria-label="Dashboard"
    >
      {items.map(({ href, label }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? 'font-semibold text-[#ba3d3d] border-b-2 border-[#ba3d3d] -mb-[13px] pb-3'
                : 'font-medium text-gray-600 hover:text-[#ba3d3d]'
            }
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
