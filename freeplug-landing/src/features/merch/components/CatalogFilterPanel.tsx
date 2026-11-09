'use client'

import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SHOP_TABS, type ShopTabSlug } from '@/lib/merch/shop/types'
import {
  catalogFilterIsActive,
  facetKeysSorted,
} from '@/lib/merch/catalog-filter-logic'
import type { CatalogFacets, CatalogFilterState, CatalogSource } from '@/lib/merch/catalog-filter-types'
import type { CatalogAvailability, CatalogDesign } from '@/lib/merch/catalog-filter-types'

const SOURCE_ORDER: CatalogSource[] = ['merch-store', 't-shirts', 'buyer-shop']
const AVAIL_ORDER: CatalogAvailability[] = ['buyable', 'coming-soon', 'missing-mockup']
const DESIGN_ORDER: CatalogDesign[] = ['freeplug', 'custom']

type Props = {
  scope: 'all-merch' | 'shop'
  facets: CatalogFacets
  state: CatalogFilterState
  onChange: (next: CatalogFilterState) => void
  onClear: () => void
  productTypeKeys: string[]
  colorKeys: string[]
  sizeKeys: string[]
}

export function CatalogFilterPanel({
  scope,
  facets,
  state,
  onChange,
  onClear,
  productTypeKeys,
  colorKeys,
  sizeKeys,
}: Props) {
  const t = useTranslations('public.merch.catalogFilter')
  const drawerTitleId = useId()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const active = catalogFilterIsActive(state, scope)

  const panel = (
    <div className="space-y-5 text-sm text-gray-700">
      {scope === 'all-merch' ? (
        <FilterSection title={t('source')}>
          <MultiCheck
            options={SOURCE_ORDER.map((id) => ({
              id,
              label: t(`source.${id}`),
              count: facets.sources[id],
            }))}
            selected={state.sources}
            onToggle={(id) => toggleInList(state.sources, id as CatalogSource, (sources) => onChange({ ...state, sources }))}
          />
        </FilterSection>
      ) : null}

      <FilterSection title={t('category')}>
        <MultiCheck
          options={SHOP_TABS.filter((c) => facets.categories[c] > 0).map((id) => ({
            id,
            label: t(`categoryTab.${id}`),
            count: facets.categories[id],
          }))}
          selected={state.categories}
          onToggle={(id) => toggleInList(state.categories, id as ShopTabSlug, (categories) => onChange({ ...state, categories }))}
        />
      </FilterSection>

      <FilterSection title={t('productType')}>
        <MultiCheck
          options={productTypeKeys.map((id) => ({
            id,
            label: id,
            count: facets.productTypes[id] ?? 0,
          }))}
          selected={state.productTypes}
          onToggle={(id) => toggleInList(state.productTypes, id, (productTypes) => onChange({ ...state, productTypes }))}
        />
      </FilterSection>

      <FilterSection title={t('availability')}>
        <MultiCheck
          options={AVAIL_ORDER.map((id) => ({
            id,
            label: t(`availability.${id}`),
            count: facets.availability[id],
          }))}
          selected={state.availability}
          onToggle={(id) =>
            toggleInList(state.availability, id as CatalogAvailability, (availability) => onChange({ ...state, availability }))
          }
        />
      </FilterSection>

      <FilterSection title={t('price')}>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-gray-500">{t('priceMin')}</span>
            <input
              type="number"
              min={0}
              step={1}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
              placeholder={String((facets.priceMinCents / 100).toFixed(0))}
              value={state.minPriceCents != null ? state.minPriceCents / 100 : ''}
              onChange={(e) => {
                const dollars = e.target.value === '' ? null : Math.round(parseFloat(e.target.value) * 100)
                onChange({
                  ...state,
                  minPriceCents: dollars != null && Number.isFinite(dollars) ? dollars : null,
                })
              }}
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">{t('priceMax')}</span>
            <input
              type="number"
              min={0}
              step={1}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
              placeholder={String((facets.priceMaxCents / 100).toFixed(0))}
              value={state.maxPriceCents != null ? state.maxPriceCents / 100 : ''}
              onChange={(e) => {
                const dollars = e.target.value === '' ? null : Math.round(parseFloat(e.target.value) * 100)
                onChange({
                  ...state,
                  maxPriceCents: dollars != null && Number.isFinite(dollars) ? dollars : null,
                })
              }}
            />
          </label>
        </div>
      </FilterSection>

      <FilterSection title={t('colors')} collapsedDefault={colorKeys.length > 12}>
        <MultiCheck
          options={colorKeys.map((id) => ({ id, label: id, count: facets.colors[id] ?? 0 }))}
          selected={state.colors}
          onToggle={(id) => toggleInList(state.colors, id, (colors) => onChange({ ...state, colors }))}
          maxVisible={14}
        />
      </FilterSection>

      <FilterSection title={t('sizes')} collapsedDefault={sizeKeys.length > 12}>
        <MultiCheck
          options={sizeKeys.map((id) => ({ id, label: id, count: facets.sizes[id] ?? 0 }))}
          selected={state.sizes}
          onToggle={(id) => toggleInList(state.sizes, id, (sizes) => onChange({ ...state, sizes }))}
          maxVisible={14}
        />
      </FilterSection>

      <FilterSection title={t('design')}>
        <MultiCheck
          options={DESIGN_ORDER.map((id) => ({
            id,
            label: t(`design.${id}`),
            count: facets.designs[id],
          }))}
          selected={state.designs}
          onToggle={(id) => toggleInList(state.designs, id as CatalogDesign, (designs) => onChange({ ...state, designs }))}
        />
      </FilterSection>

      <FilterSection title={t('sortLabel')}>
        <select
          className="w-full rounded-lg border border-gray-200 px-3 py-2"
          value={state.sort}
          onChange={(e) => onChange({ ...state, sort: e.target.value as CatalogFilterState['sort'] })}
        >
          <option value="featured">{t('sort.featured')}</option>
          <option value="price-asc">{t('sort.priceAsc')}</option>
          <option value="price-desc">{t('sort.priceDesc')}</option>
          <option value="name-asc">{t('sort.nameAsc')}</option>
        </select>
      </FilterSection>

      {active ? (
        <button type="button" className="w-full rounded-lg border border-gray-300 py-2.5 min-h-11 font-medium hover:border-[#ba3d3d]/40" onClick={onClear}>
          {t('clearAll')}
        </button>
      ) : null}
    </div>
  )

  return (
  <>
    <div className="lg:hidden mb-4 flex items-center gap-3">
      <button
        type="button"
        className="flex-1 rounded-full min-h-11 px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-800"
        onClick={() => setMobileOpen(true)}
      >
        {t('openFilters')}
        {active ? <span className="ml-2 text-[#ba3d3d]">•</span> : null}
      </button>
    </div>

    <aside className="hidden lg:block lg:w-64 shrink-0">
      <h2 className="text-base font-semibold text-gray-900 mb-4">{t('heading')}</h2>
      {panel}
    </aside>

    {mobileOpen ? (
      <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-labelledby={drawerTitleId}>
        <button type="button" className="absolute inset-0 bg-black/40" aria-label={t('closeFilters')} onClick={() => setMobileOpen(false)} />
        <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 id={drawerTitleId} className="text-lg font-semibold text-gray-900">
              {t('heading')}
            </h2>
            <button type="button" className="min-h-11 px-3 text-sm font-medium text-[#ba3d3d]" onClick={() => setMobileOpen(false)}>
              {t('done')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{panel}</div>
        </div>
      </div>
    ) : null}
  </>
  )
}

export function useCatalogFilterFacetLists(facets: CatalogFacets) {
  return {
    productTypeKeys: facetKeysSorted(facets.productTypes, 40),
    colorKeys: facetKeysSorted(facets.colors, 60),
    sizeKeys: facetKeysSorted(facets.sizes, 40),
  }
}

function FilterSection({
  title,
  children,
  collapsedDefault,
}: {
  title: string
  children: ReactNode
  collapsedDefault?: boolean
}) {
  const [open, setOpen] = useState(!collapsedDefault)
  return (
    <div className="border-b border-gray-100 pb-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left font-semibold text-gray-900 mb-2 min-h-10"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {title}
        <span className="text-gray-400 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open ? children : null}
    </div>
  )
}

function MultiCheck({
  options,
  selected,
  onToggle,
  maxVisible = 99,
}: {
  options: { id: string; label: string; count: number }[]
  selected: string[]
  onToggle: (id: string) => void
  maxVisible?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? options : options.slice(0, maxVisible)
  if (!options.length) return <p className="text-xs text-gray-400">—</p>
  return (
    <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {visible.map((opt) => {
        const on = selected.includes(opt.id)
        return (
          <li key={opt.id}>
            <label className="flex items-start gap-2 cursor-pointer min-h-9">
              <input type="checkbox" className="mt-1" checked={on} onChange={() => onToggle(opt.id)} />
              <span className="flex-1 leading-snug">
                {opt.label}{' '}
                <span className="text-gray-400 text-xs">({opt.count})</span>
              </span>
            </label>
          </li>
        )
      })}
      {options.length > maxVisible ? (
        <li>
          <button type="button" className="text-xs text-[#ba3d3d] font-medium py-1" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show less' : `Show ${options.length - maxVisible} more`}
          </button>
        </li>
      ) : null}
    </ul>
  )
}

function toggleInList<T extends string>(list: T[], id: T, set: (next: T[]) => void) {
  if (list.includes(id)) set(list.filter((x) => x !== id))
  else set([...list, id])
}
