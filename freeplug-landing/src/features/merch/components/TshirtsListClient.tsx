'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { CatalogFilterPanel } from '@/features/merch/components/CatalogFilterPanel'
import { ShirtMockupFigure } from '@/features/merch/components/ShirtMockupFigure'
import { fadeInUp, staggerContainer } from '@/features/landing/animations/landing.variants'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MERCH_PAGE_TITLE_SCROLL_MT, MERCH_TSHIRT_MAIN_CLASS } from '@/features/merch/merch-main-layout'
import { useCatalogFilterUrl } from '@/features/merch/hooks/useCatalogFilterUrl'
import { applyCatalogFilters, computeCatalogFacets, sortCatalogItems } from '@/lib/merch/catalog-filter-logic'
import { computePreviewWordmarkFacets } from '@/lib/merch/preview/preview-wordmark-filter'
import { shirtProductsToCatalogFilterItems } from '@/lib/merch/shirts/shirt-catalog-filter-items'
import { formatUsdFromCents, shirtListCardFrontMockup, type PublicShirtProduct } from '@/lib/merch/shirts/catalog'

export function TshirtsListClient({ products }: { products: PublicShirtProduct[] }) {
  const t = useTranslations('public.merch.tshirts')
  const tMerch = useTranslations('public.merch')
  const locale = toAppLocale(useLocale())
  const { state, setState, clearAll } = useCatalogFilterUrl('t-shirts')

  const items = useMemo(() => shirtProductsToCatalogFilterItems(products), [products])
  const filtered = useMemo(() => sortCatalogItems(applyCatalogFilters(items, state), state.sort), [items, state])
  const panelFacets = useMemo(() => computeCatalogFacets(items), [items])
  const previewWordmarkFacets = useMemo(() => computePreviewWordmarkFacets(items), [items])
  const bySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products])

  return (
    <MerchPageChrome>
      <main className={MERCH_TSHIRT_MAIN_CLASS} data-testid="tshirts-list">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0">
          <div className="lg:flex lg:gap-8 lg:items-start">
            <CatalogFilterPanel
              scope="t-shirts"
              panelFacets={panelFacets}
              previewWordmarkFacets={previewWordmarkFacets}
              state={state}
              onChange={setState}
              onClear={clearAll}
            />

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="flex-1 min-w-0"
            >
              <motion.h1
                variants={fadeInUp}
                className={`${MERCH_PAGE_TITLE_SCROLL_MT} text-2xl sm:text-3xl font-bold text-gray-900 mb-3 break-words`}
              >
                {t('heading')}
              </motion.h1>
              <motion.div variants={fadeInUp} className="mb-6 sm:mb-8 max-w-2xl space-y-2 min-w-0">
                <p className="text-base sm:text-lg text-gray-600 leading-relaxed">{t('listingLead')}</p>
                <p className="text-sm sm:text-base text-gray-500 break-words leading-relaxed">{t('priceFrontOnly')}</p>
                <p className="text-sm sm:text-base text-gray-500 break-words leading-relaxed">{t('priceFrontBack')}</p>
              </motion.div>

              <p className="text-sm text-gray-500 mb-4" aria-live="polite">
                {tMerch('catalogFilter.showingOf', { shown: filtered.length, total: filtered.length, all: items.length })}
              </p>

              <ul className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 min-w-0">
                {filtered.map((row) => {
                  const p = bySlug.get(row.key.replace('tshirts/', ''))
                  if (!p) return null
                  const { color: listColor, src: img } = shirtListCardFrontMockup(p)
                  const title = t(`products.${p.titleKey}`)
                  return (
                    <motion.li key={p.slug} variants={fadeInUp} className="min-w-0">
                      <Link
                        href={publicHref(`/merch/t-shirts/${p.slug}`, locale)}
                        className="block rounded-2xl border border-gray-200 bg-white overflow-hidden hover:border-[#ba3d3d]/40 transition-colors min-h-[44px]"
                      >
                        {img ? (
                          <ShirtMockupFigure
                            slug={p.slug}
                            src={img}
                            alt={t('cardAlt', { title })}
                            width={1000}
                            height={1200}
                            shirtColor={listColor}
                            className="border-0 rounded-none"
                            sizes="(max-width: 640px) 100vw, 320px"
                            showOverlay={state.previewOverlays}
                          />
                        ) : null}
                        <div className="p-3.5 sm:p-4 min-w-0">
                          <h2 className="font-semibold text-gray-900 text-[0.95rem] min-[360px]:text-base leading-snug break-words">
                            {title}
                          </h2>
                          <p className="text-sm min-[360px]:text-base text-[#ba3d3d] font-semibold mt-1.5">
                            {t('fromPrice', { price: formatUsdFromCents(p.fromPriceCents) })}
                          </p>
                        </div>
                      </Link>
                    </motion.li>
                  )
                })}
              </ul>
            </motion.div>
          </div>
        </div>
      </main>
    </MerchPageChrome>
  )
}
