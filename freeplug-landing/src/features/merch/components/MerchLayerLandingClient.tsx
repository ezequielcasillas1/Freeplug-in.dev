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
import { formatUsdFromCents } from '@/lib/merch/shop/pricing'
import type { AllMerchItem } from '@/lib/merch/all-merch-shared'
import type { MerchLayer } from '@/lib/merch/layers/layers'
import { ALL_MERCH_PAGE_SIZE } from '@/features/merch/components/AllMerchListClient'

export function MerchLayerLandingClient({ items, layer }: { items: AllMerchItem[]; layer: MerchLayer }) {
  const t = useTranslations('public.merch')
  const tLayer = useTranslations('public.merch.layers')
  const locale = toAppLocale(useLocale())
  const { state, setState, clearAll } = useCatalogFilterUrl('all-merch')
  const [shown, setShown] = useState(ALL_MERCH_PAGE_SIZE)

  const layerItems = useMemo(() => items.filter((i) => i.layer === layer), [items, layer])

  const effectiveState = useMemo(() => ({ ...state, layers: [layer] as MerchLayer[] }), [state, layer])

  const filtered = useMemo(
    () => sortCatalogItems(applyCatalogFilters(layerItems, effectiveState), effectiveState.sort) as AllMerchItem[],
    [layerItems, effectiveState]
  )
  const visible = filtered.slice(0, shown)

  const panelFacets = useMemo(() => computePanelFacets(layerItems, effectiveState), [layerItems, effectiveState])

  return (
    <MerchPageChrome>
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-6 pb-16" data-testid={`merch-layer-${layer}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-sm text-gray-500 mb-3">
            <Link href={publicHref('/merch', locale)} className="hover:text-[#ba3d3d] min-h-[44px] inline-flex items-center">
              {t('breadcrumbMerch')}
            </Link>
          </p>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#ba3d3d] mb-2">{tLayer(`names.${layer}`)}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">{tLayer(`landing.${layer}.title`)}</h1>
          <p className="text-gray-600 mb-6 max-w-2xl">{tLayer(`landing.${layer}.lead`)}</p>

          <div className="lg:flex lg:gap-8 lg:items-start">
            <CatalogFilterPanel
              scope="all-merch"
              panelFacets={panelFacets}
              state={effectiveState}
              onChange={(next) => {
                setState({ ...next, layers: [layer] })
                setShown(ALL_MERCH_PAGE_SIZE)
              }}
              onClear={() => {
                clearAll()
                setShown(ALL_MERCH_PAGE_SIZE)
              }}
              hideLayers
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 mb-4" aria-live="polite">
                {t('catalogFilter.showingOf', { shown: visible.length, total: filtered.length, all: layerItems.length })}
              </p>

              {layerItems.length === 0 || visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white/80 px-6 py-12 text-center">
                  <p className="text-gray-700 font-medium">{tLayer('comingSoonTitle')}</p>
                  <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">{tLayer('comingSoonBody')}</p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {visible.map((item) => {
                    const title = item.titleKey ? t(item.titleKey) : item.title
                    return (
                      <li key={item.key} className="min-w-0">
                        <Link
                          href={publicHref(item.href, locale)}
                          className="block h-full rounded-xl border border-gray-200 bg-white p-3 sm:p-4 hover:border-[#ba3d3d]/40 transition-colors"
                        >
                          <div className="aspect-square rounded-lg bg-zinc-100 mb-3 overflow-hidden relative">
                            {item.image ? (
                              <CatalogCardImage src={item.image} sizes="(max-width: 1024px) 50vw, 260px" />
                            ) : null}
                            {item.comingSoonLabel ? (
                              <span className="absolute top-2 left-2 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-medium text-white">
                                {t('comingSoon')}
                              </span>
                            ) : null}
                          </div>
                          <h2 className="font-semibold text-gray-900 text-sm sm:text-base leading-snug line-clamp-2 break-words">
                            {title}
                          </h2>
                          <p className="text-sm text-[#ba3d3d] font-semibold mt-1">
                            {t('shop.fromPrice', { price: formatUsdFromCents(item.fromPriceCents) })}
                          </p>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}

              {visible.length < filtered.length ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    className="rounded-full px-6 py-3 min-h-11 text-sm font-medium bg-[#ba3d3d] text-white hover:bg-[#a33535]"
                    onClick={() => setShown((n) => n + ALL_MERCH_PAGE_SIZE)}
                  >
                    {t('allMerch.showMore')}
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
