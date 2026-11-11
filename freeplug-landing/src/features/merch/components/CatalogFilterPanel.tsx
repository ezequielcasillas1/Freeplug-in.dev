'use client'

import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SHOP_TABS, type ShopTabSlug } from '@/lib/merch/shop/types'
import { CATALOG_SIZE_FACET_ONE_SIZE } from '@/lib/merch/catalog-size-facet'
import { catalogFilterIsActive, facetKeysSorted } from '@/lib/merch/catalog-filter-logic'
import type { CatalogFacets, CatalogFilterState, CatalogSource } from '@/lib/merch/catalog-filter-types'
import type { CatalogAvailability, CatalogDesign } from '@/lib/merch/catalog-filter-types'
import type { CatalogFilterScope } from '@/lib/merch/catalog-filter-types'
import { BRAND_NAME_KEYS, type BrandNameKey } from '@/lib/merch/preview/brand-names'
import type { PreviewWordmarkFacets } from '@/lib/merch/preview/preview-wordmark-filter'
import { WORDMARK_STYLE_GROUPS, type WordmarkStyleGroup } from '@/lib/merch/preview/wordmark-style-groups'

const SOURCE_ORDER: CatalogSource[] = ['merch-store', 't-shirts', 'buyer-shop']
const AVAIL_ORDER: CatalogAvailability[] = ['buyable', 'coming-soon', 'missing-mockup']
const DESIGN_ORDER: CatalogDesign[] = ['freeplug', 'custom']

type Props = {
  scope: CatalogFilterScope
  panelFacets: CatalogFacets
  previewWordmarkFacets?: PreviewWordmarkFacets
  state: CatalogFilterState
  onChange: (next: CatalogFilterState) => void
  onClear: () => void
}

export function CatalogFilterPanel({ scope, panelFacets, previewWordmarkFacets, state, onChange, onClear }: Props) {
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
  const showCatalogFacets = scope === 'all-merch' || scope === 'shop'

  const productTypeKeys = facetKeysSorted(panelFacets.productTypes, 40)
  const colorKeys = facetKeysSorted(panelFacets.colors, 60).filter((k) => (panelFacets.colors[k] ?? 0) > 0)
  const sizeKeys = facetKeysSorted(panelFacets.sizes, 40).filter((k) => (panelFacets.sizes[k] ?? 0) > 0)

  const panel = (
    <div className="space-y-5 text-sm text-gray-700">
      {showCatalogFacets && scope === 'all-merch' ? (
        <FilterSection title={t('sourceTitle')}>
          <MultiCheck
            t={t}
            options={SOURCE_ORDER.map((id) => ({
              id,
              label: t(`source.${id}`),
              count: panelFacets.sources[id],
            })).filter((o) => o.count > 0)}
            selected={state.sources}
            onToggle={(id) => toggleInList(state.sources, id as CatalogSource, (sources) => onChange({ ...state, sources }))}
          />
        </FilterSection>
      ) : null}

      {showCatalogFacets ? (
      <FilterSection title={t('category')}>
        <MultiCheck
          t={t}
          options={SHOP_TABS.filter((c) => panelFacets.categories[c] > 0).map((id) => ({
            id,
            label: t(`categoryTab.${id}`),
            count: panelFacets.categories[id],
          }))}
          selected={state.categories}
          onToggle={(id) => toggleInList(state.categories, id as ShopTabSlug, (categories) => onChange({ ...state, categories }))}
        />
      </FilterSection>
      ) : null}

      {showCatalogFacets && productTypeKeys.length > 0 ? (
        <FilterSection title={t('productType')}>
          <MultiCheck
            t={t}
            options={productTypeKeys.map((id) => ({
              id,
              label: productTypeLabel(t, id),
              count: panelFacets.productTypes[id] ?? 0,
            }))}
            selected={state.productTypes}
            onToggle={(id) => toggleInList(state.productTypes, id, (productTypes) => onChange({ ...state, productTypes }))}
          />
        </FilterSection>
      ) : null}

      {showCatalogFacets ? (
      <FilterSection title={t('availabilityTitle')}>
        <MultiCheck
          t={t}
          options={AVAIL_ORDER.map((id) => ({
            id,
            label: t(`availability.${id}`),
            count: panelFacets.availability[id],
          })).filter((o) => o.count > 0)}
          selected={state.availability}
          onToggle={(id) =>
            toggleInList(state.availability, id as CatalogAvailability, (availability) => onChange({ ...state, availability }))
          }
        />
      </FilterSection>
      ) : null}

      {showCatalogFacets ? (
      <FilterSection title={t('price')}>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-gray-500">{t('priceMin')}</span>
            <input
              type="number"
              min={0}
              step={1}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
              placeholder={String((panelFacets.priceMinCents / 100).toFixed(0))}
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
              placeholder={String((panelFacets.priceMaxCents / 100).toFixed(0))}
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
      ) : null}

      {showCatalogFacets && colorKeys.length > 0 ? (
        <FilterSection title={t('colors')} defaultOpen>
          <MultiCheck
            t={t}
            options={colorKeys.map((id) => ({ id, label: id, count: panelFacets.colors[id] ?? 0 }))}
            selected={state.colors}
            onToggle={(id) => toggleInList(state.colors, id, (colors) => onChange({ ...state, colors }))}
            maxVisible={14}
          />
        </FilterSection>
      ) : null}

      {showCatalogFacets && sizeKeys.length > 0 ? (
        <FilterSection title={t('sizes')} defaultOpen>
          <MultiCheck
            t={t}
            options={sizeKeys.map((id) => ({
              id,
              label: id === CATALOG_SIZE_FACET_ONE_SIZE ? t('sizeOneSize') : id,
              count: panelFacets.sizes[id] ?? 0,
            }))}
            selected={state.sizes}
            onToggle={(id) => toggleInList(state.sizes, id, (sizes) => onChange({ ...state, sizes }))}
            maxVisible={14}
          />
        </FilterSection>
      ) : null}

      {showCatalogFacets ? (
      <FilterSection title={t('designTitle')}>
        <MultiCheck
          t={t}
          options={DESIGN_ORDER.map((id) => ({
            id,
            label: t(`design.${id}`),
            count: panelFacets.designs[id],
          })).filter((o) => o.count > 0)}
          selected={state.designs}
          onToggle={(id) => toggleInList(state.designs, id as CatalogDesign, (designs) => onChange({ ...state, designs }))}
        />
      </FilterSection>
      ) : null}

      <FilterSection title={t('previewWordmark.title')} defaultOpen>
        <label className="flex items-start gap-2 cursor-pointer min-h-9 mb-3">
          <input
            type="checkbox"
            className="mt-1 shrink-0"
            checked={state.previewOverlays}
            onChange={() => onChange({ ...state, previewOverlays: !state.previewOverlays })}
          />
          <span className="leading-snug break-words min-w-0">
            {state.previewOverlays ? t('previewWordmark.showOnPhotos') : t('previewWordmark.hideOnPhotos')}
          </span>
        </label>
        {previewWordmarkFacets ? (
          <>
            {previewWordmarkFacets.rectangularStyle > 0 ? (
              <>
                <p className="text-xs font-semibold text-gray-800 mb-2">{t('previewWordmark.rectangularStyleTitle')}</p>
                <label className="flex items-start gap-2 cursor-pointer min-h-9 mb-3">
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0"
                    checked={state.rectangularStyleOnly}
                    onChange={() => onChange({ ...state, rectangularStyleOnly: !state.rectangularStyleOnly })}
                  />
                  <span className="leading-snug break-words min-w-0">
                    {t('previewWordmark.rectangularStyle')}{' '}
                    <span className="text-gray-400 text-xs">({previewWordmarkFacets.rectangularStyle})</span>
                  </span>
                </label>
              </>
            ) : null}
            <p className="text-xs font-semibold text-gray-800 mb-2">{t('previewWordmark.brandNameTitle')}</p>
            <MultiCheck
              t={t}
              options={BRAND_NAME_KEYS.map((id) => ({
                id,
                label: t(`previewWordmark.brandNames.${id}`),
                count: previewWordmarkFacets.brandNames[id],
              })).filter((o) => o.count > 0)}
              selected={state.brandNameKeys}
              onToggle={(id) =>
                toggleInList(state.brandNameKeys, id as BrandNameKey, (brandNameKeys) =>
                  onChange({ ...state, brandNameKeys })
                )
              }
            />
            <p className="text-xs font-semibold text-gray-800 mb-2 mt-3">{t('previewWordmark.styleTitle')}</p>
            <MultiCheck
              t={t}
              options={WORDMARK_STYLE_GROUPS.map((id) => ({
                id,
                label: t(`previewWordmark.styles.${id}`),
                count: previewWordmarkFacets.styles[id],
              })).filter((o) => o.count > 0)}
              selected={state.wordmarkStyleGroups}
              onToggle={(id) =>
                toggleInList(state.wordmarkStyleGroups, id as WordmarkStyleGroup, (wordmarkStyleGroups) =>
                  onChange({ ...state, wordmarkStyleGroups })
                )
              }
            />
          </>
        ) : null}
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
        <button
          type="button"
          className="w-full rounded-lg border border-gray-300 py-2.5 min-h-11 font-medium hover:border-[#ba3d3d]/40"
          onClick={onClear}
        >
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

      <aside className="hidden lg:block lg:w-72 shrink-0 min-w-0">
        <h2 className="text-base font-semibold text-gray-900 mb-4 break-words">{t('heading')}</h2>
        {panel}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-labelledby={drawerTitleId}>
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={t('closeFilters')} onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 gap-2">
              <h2 id={drawerTitleId} className="text-lg font-semibold text-gray-900 break-words min-w-0">
                {t('heading')}
              </h2>
              <button type="button" className="min-h-11 px-3 text-sm font-medium text-[#ba3d3d] shrink-0" onClick={() => setMobileOpen(false)}>
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

function productTypeLabel(t: ReturnType<typeof useTranslations>, slug: string): string {
  const key = `productTypeLabels.${slug}`
  return t.has(key as Parameters<typeof t>[0]) ? t(key as Parameters<typeof t>[0]) : slug
}

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 pb-4">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left font-semibold text-gray-900 mb-2 min-h-10"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="break-words min-w-0 flex-1">{title}</span>
        <span className="text-gray-400 text-xs shrink-0 pt-0.5">{open ? '−' : '+'}</span>
      </button>
      {open ? children : null}
    </div>
  )
}

function MultiCheck({
  t,
  options,
  selected,
  onToggle,
  maxVisible = 99,
}: {
  t: ReturnType<typeof useTranslations>
  options: { id: string; label: string; count: number }[]
  selected: string[]
  onToggle: (id: string) => void
  maxVisible?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? options : options.slice(0, maxVisible)
  if (!options.length) return null
  return (
    <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
      {visible.map((opt) => {
        const on = selected.includes(opt.id)
        return (
          <li key={opt.id}>
            <label className="flex items-start gap-2 cursor-pointer min-h-9">
              <input type="checkbox" className="mt-1 shrink-0" checked={on} onChange={() => onToggle(opt.id)} />
              <span className="flex-1 leading-snug break-words min-w-0">
                {opt.label}{' '}
                <span className="text-gray-400 text-xs whitespace-nowrap">({opt.count})</span>
              </span>
            </label>
          </li>
        )
      })}
      {options.length > maxVisible ? (
        <li>
          <button type="button" className="text-xs text-[#ba3d3d] font-medium py-1 break-words text-left" onClick={() => setExpanded((v) => !v)}>
            {expanded ? t('showLessOptions') : t('showMoreOptions', { count: options.length - maxVisible })}
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
