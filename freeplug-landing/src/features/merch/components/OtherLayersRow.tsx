'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { CatalogCardImage } from '@/features/merch/components/CatalogCardImage'
import type { AllMerchItem } from '@/lib/merch/all-merch-shared'
import { formatUsdFromCents } from '@/lib/merch/shop/pricing'

export function OtherLayersRow({ items }: { items: AllMerchItem[] }) {
  const t = useTranslations('public.merch.layers')
  const tMerch = useTranslations('public.merch')
  const locale = toAppLocale(useLocale())
  if (!items.length) return null

  return (
    <section className="mt-10 pt-8 border-t border-gray-200" data-testid="other-layers-row">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">{t('otherLayersHeading')}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map((item) => {
          const title = item.titleKey ? tMerch(item.titleKey) : item.title
          return (
            <li key={item.key} className="min-w-0">
              <Link
                href={publicHref(item.href, locale)}
                className="block rounded-xl border border-gray-200 bg-white p-3 hover:border-[#ba3d3d]/40 transition-colors h-full"
              >
                <div className="aspect-square rounded-lg bg-zinc-100 mb-2 overflow-hidden relative">
                  {item.image ? (
                    <CatalogCardImage src={item.image} sizes="(max-width: 640px) 45vw, 160px" />
                  ) : null}
                </div>
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">{title}</p>
                <p className="text-xs text-[#ba3d3d] font-semibold mt-1">
                  {tMerch('shop.fromPrice', { price: formatUsdFromCents(item.fromPriceCents) })}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
