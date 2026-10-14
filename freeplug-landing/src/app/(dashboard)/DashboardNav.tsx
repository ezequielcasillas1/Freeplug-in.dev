'use client'

import { useEffect, useRef, useState } from 'react'
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

/** True while the scroll box has content hidden past its right edge (1 px slack for rounding). */
export function hasMoreRight(el: Pick<HTMLElement, 'scrollLeft' | 'clientWidth' | 'scrollWidth'>): boolean {
  return el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

export function DashboardNav() {
  const pathname = usePathname()
  const t = useTranslations('dashboard.nav')
  const navRef = useRef<HTMLElement>(null)
  const [moreRight, setMoreRight] = useState(false)

  // 375 px (Oct 13): bring the active tab into view on load, and show a soft right-edge fade only
  // while more tabs are hidden to the right (scroll, resize, and font/translation width changes).
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (active && (active.offsetLeft < nav.scrollLeft || active.offsetLeft + active.offsetWidth > nav.scrollLeft + nav.clientWidth)) {
      nav.scrollLeft = Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2)
    }
    const update = () => setMoreRight(hasMoreRight(nav))
    update()
    nav.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      nav.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [pathname])

  // One row that scrolls sideways on narrow screens instead of wrapping (Lina, Sep 25). The
  // wrapper draws the bottom rule so the scroll area never clips the active underline.
  return (
    <div className="relative border-b border-zinc-200 mb-8">
      <nav
        ref={navRef}
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
      {moreRight ? (
        <div
          aria-hidden="true"
          data-testid="dash-nav-fade"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent"
        />
      ) : null}
    </div>
  )
}
