'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/change-requests', label: 'Change requests' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/accounts', label: 'Accounts' },
  { href: '/admin/outreach', label: 'Outreach' },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap items-center gap-4 text-sm">
      {links.map(({ href, label }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? 'font-semibold text-[#ba3d3d]'
                : 'text-zinc-500 hover:text-[#ba3d3d]'
            }
          >
            {label}
          </Link>
        )
      })}
      <Link href="/" className="text-zinc-500 hover:text-[#ba3d3d] ml-auto text-xs">
        ← Site
      </Link>
    </nav>
  )
}
