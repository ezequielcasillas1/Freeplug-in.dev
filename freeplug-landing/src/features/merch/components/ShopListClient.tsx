'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toAppLocale } from '@/i18n/config'
import { publicHref } from '@/i18n/routing'
import { MerchPageChrome } from '@/features/merch/components/MerchPageChrome'
import { formatUsdFromCents } from '@/lib/merch/shop/pricing'
import { filterShopCards, sortShopCards, uniqueProductTypes, type ShopFilters, type ShopSort } from '@/lib/merch/shop/filters'
import { SHOP_TABS, type ShopCard, type ShopTabSlug } from '@/lib/merch/shop/types'

export function ShopListClient({ cards, initialTab }: { cards: ShopCard[]; initialTab: ShopTabSlug | 'all' }) {
  const t = useTranslations('public.merch.shop')
  const locale = toAppLocale(useLocale())
  const [tab, setTab] = useState<ShopTabSlug | 'all'>(initialTab)
  const [sort, setSort] = useState<ShopSort>('featured')
  const [filters, setFilters] = useState<ShopFilters>({})

  const tabCards = useMemo(() => (tab === 'all' ? cards : cards.filter((c) => c.tab === tab)), [cards, tab])
  const productTypes = useMemo(() => uniqueProductTypes(tabCards), [tabCards])
  const visible = useMemo(() => sortShopCards(filterShopCards(tabCards, filters), sort), [tabCards, filters, sort])

  return (
    <MerchPageChrome>
      <main className="min-h-screen bg-gradient-to-b from-white to-zinc-50 pt-6 pb-16" data-testid="shop-landing">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#ba3d3d] mb-2">{t('eyebrow')}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">{t('heading')}</h1>
          <p className="text-gray-600 mb-8 max-w-2xl">{t('lead')}</p>

          <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label={t('tabsAria')}>
            <button
              type="button"
              className={tab === 'all' ? tabClass(true) : tabClass(false)}
              onClick={() => setTab('all')}
            >
              {t('tabs.all')}
            </button>
            {SHOP_TABS.map((slug) => (
              <button
                key={slug}
                type="button"
                className={tab === slug ? tabClass(true) : tabClass(false)}
                onClick={() => setTab(slug)}
              >
                {t(`tabs.${slug}`)}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <label className="text-sm text-gray-600">
              {t('filters.sort')}
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                value={sort}
                onChange={(e) => setSort(e.target.value as ShopSort)}
              >
                <option value="featured">{t('sort.featured')}</option>
                <option value="price-asc">{t('sort.priceAsc')}</option>
                <option value="price-desc">{t('sort.priceDesc')}</option>
              </select>
            </label>
            <label className="text-sm text-gray-600">
              {t('filters.price')}
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'under25') setFilters((f) => ({ ...f, minPriceCents: undefined, maxPriceCents: 2499 }))
                  else if (v === '25-50') setFilters((f) => ({ ...f, minPriceCents: 2500, maxPriceCents: 5000 }))
                  else if (v === 'over50') setFilters((f) => ({ ...f, minPriceCents: 5001, maxPriceCents: undefined }))
                  else setFilters((f) => ({ ...f, minPriceCents: undefined, maxPriceCents: undefined }))
                }}
                defaultValue=""
              >
                <option value="">{t('filters.priceAny')}</option>
                <option value="under25">{t('filters.priceUnder25')}</option>
                <option value="25-50">{t('filters.price25to50')}</option>
                <option value="over50">{t('filters.priceOver50')}</option>
              </select>
            </label>
            <label className="text-sm text-gray-600">
              {t('filters.productType')}
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                onChange={(e) => setFilters((f) => ({ ...f, productType: e.target.value || undefined }))}
                defaultValue=""
              >
                <option value="">{t('filters.typeAny')}</option>
                {productTypes.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-600">
              {t('filters.color')}
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                placeholder={t('filters.colorPlaceholder')}
                onChange={(e) => setFilters((f) => ({ ...f, color: e.target.value || undefined }))}
              />
            </label>
          </div>

          <p className="text-sm text-gray-500 mb-4">{t('results', { count: visible.length })}</p>

          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((item) => (
              <li key={item.slug}>
                <Link
                  href={publicHref(`/shop/${item.slug}`, locale)}
                  className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-[#ba3d3d]/40 transition-colors min-h-full"
                >
                  <div className="aspect-square rounded-lg bg-zinc-100 mb-3 overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/merch/shop/placeholder-product.svg" alt="" className="w-full h-full object-contain" />
                  </div>
                  <h2 className="font-semibold text-gray-900 line-clamp-2">{item.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">{t('fromPrice', { price: formatUsdFromCents(item.fromRetailCents) })}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </MerchPageChrome>
  )
}

function tabClass(active: boolean): string {
  return active
    ? 'rounded-full px-4 py-2 text-sm font-medium bg-[#ba3d3d] text-white'
    : 'rounded-full px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:border-[#ba3d3d]/30'
}
