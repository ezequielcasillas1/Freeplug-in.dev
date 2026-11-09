'use client'

import { CatalogCardImage } from '@/features/merch/components/CatalogCardImage'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { CatalogFilterPanel } from '@/features/merch/components/CatalogFilterPanel'
import { useCatalogFilterUrl } from '@/features/merch/hooks/useCatalogFilterUrl'
import { applyCatalogFilters, computePanelFacets, sortCatalogItems } from '@/lib/merch/catalog-filter-logic'
import type { CatalogFilterItem } from '@/lib/merch/catalog-filter-types'
import { formatUsdFromCents } from '@/lib/merch/shop/pricing'
import { ALL_MERCH_PAGE_SIZE } from '@/features/merch/components/AllMerchListClient'

export function ShopListClient({ items }: { items: CatalogFilterItem[] }) {
  const t = useTranslations('public.merch.shop')
  const tMerch = useTranslations('public.merch')
  const locale = toAppLocale(useLocale())
  const { state, setState, clearAll } = useCatalogFilterUrl('shop')
  const [shown, setShown] = useState(ALL_MERCH_PAGE_SIZE)

  const filtered = useMemo(() => sortCatalogItems(applyCatalogFilters(items, state), state.sort), [items, state])
  const visible = filtered.slice(0, shown)

  const panelFacets = useMemo(() => computePanelFacets(items, state), [items, state])

  return (
    <MerchPageChrome>
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-6 pb-16" data-testid="shop-landing">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#ba3d3d] mb-2">{t('eyebrow')}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">{t('heading')}</h1>
          <p className="text-gray-600 mb-6 max-w-2xl">{t('lead')}</p>

          <div className="lg:flex lg:gap-8 lg:items-start">
            <CatalogFilterPanel
              scope="shop"
              panelFacets={panelFacets}
              state={state}
              onChange={(next) => {
                setState(next)
                setShown(ALL_MERCH_PAGE_SIZE)
              }}
              onClear={() => {
                clearAll()
                setShown(ALL_MERCH_PAGE_SIZE)
              }}
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 mb-4" aria-live="polite">
                {tMerch('catalogFilter.showingOf', { shown: visible.length, total: filtered.length, all: items.length })}
              </p>

              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {visible.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={publicHref(item.href, locale)}
                      className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-[#ba3d3d]/40 transition-colors min-h-full"
                    >
                      <div className="aspect-square rounded-lg bg-zinc-100 mb-3 overflow-hidden relative">
                        <CatalogCardImage src={item.image} sizes="(max-width: 768px) 50vw, 240px" />
                        {item.comingSoonLabel ? (
                          <span className="absolute top-2 left-2 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-medium text-white">
                            {t('comingSoon')}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="font-semibold text-gray-900 line-clamp-2">{item.title}</h2>
                      <p className="text-sm text-gray-500 mt-1">{t('fromPrice', { price: formatUsdFromCents(item.fromPriceCents) })}</p>
                    </Link>
                  </li>
                ))}
              </ul>

              {visible.length < filtered.length ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    className="rounded-full px-6 py-3 min-h-11 text-sm font-medium bg-[#ba3d3d] text-white hover:bg-[#a33535]"
                    onClick={() => setShown((n) => n + ALL_MERCH_PAGE_SIZE)}
                  >
                    {tMerch('allMerch.showMore')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </MerchPageChrome>
  )
}
