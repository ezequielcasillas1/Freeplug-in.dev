'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MERCH_TSHIRTS_SLUG } from '@/lib/merch/product'
import { MERCH_COLLECTIONS } from '@/lib/merch/collections/catalog'
import { cn } from '@/lib/utils/cn'

const LINKS = [
  { slug: MERCH_TSHIRTS_SLUG, labelKey: 'subnav.tshirts' as const },
  ...MERCH_COLLECTIONS.map((c) => ({
    slug: c,
    labelKey: `subnav.collections.${c}` as const,
  })),
]

export function MerchandiseNavMenu({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const tLanding = useTranslations('public.landing')
  const tMerch = useTranslations('public.merch')
  const locale = toAppLocale(useLocale())
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="relative px-4 py-2 text-gray-600 hover:text-[#ba3d3d] transition-colors font-medium inline-flex items-center gap-1 min-h-11"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {tLanding('navigation.label.merchandise')}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 min-w-[12rem] rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
          {LINKS.map((link) => (
            <Link
              key={link.slug}
              href={publicHref(`/merch/${link.slug}`, locale)}
              className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-[#ba3d3d]/5 hover:text-[#ba3d3d]"
              onClick={() => {
                setOpen(false)
                onNavigate?.()
              }}
            >
              {tMerch(link.labelKey)}
            </Link>
          ))}
          <Link
            href={publicHref('/merch', locale)}
            className="block px-4 py-2 text-xs text-gray-500 hover:text-[#ba3d3d] border-t border-gray-100 mt-1"
            onClick={() => {
              setOpen(false)
              onNavigate?.()
            }}
          >
            {tMerch('subnav.allMerch')}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
