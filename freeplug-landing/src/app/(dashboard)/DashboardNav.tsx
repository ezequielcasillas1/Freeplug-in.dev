'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

const items = [
  { href: '/dashboard', key: 'overview' },
  { href: '/dashboard/plans', key: 'plans' },
  { href: '/dashboard/request-website', key: 'requestWebsite' },
  { href: '/dashboard/help', key: 'help' },
  { href: '/dashboard/settings', key: 'settings' },
  { href: '/dashboard/cancel', key: 'cancel' },
] as const

export function DashboardNav() {
  const pathname = usePathname()
  const t = useTranslations('dashboard.nav')

  // One row that scrolls sideways on narrow screens instead of wrapping (Lina, Sep 25). The
  // wrapper draws the bottom rule so the scroll area never clips the active underline.
  return (
    <div className="border-b border-zinc-200 mb-8">
      <nav
        className="-mb-px flex flex-nowrap gap-6 overflow-x-auto whitespace-nowrap text-sm"
        aria-label={t('ariaLabel.dashboard')}
      >
        {items.map(({ href, key }) => {
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
              {t(`label.${key}`)}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
