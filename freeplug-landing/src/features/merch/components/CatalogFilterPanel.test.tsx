import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import en from '../../../../messages/en.json'
import es from '../../../../messages/es.json'
import { setTestLocale } from '../../../../test/intl-mock'
import { CatalogFilterPanel } from './CatalogFilterPanel'
import { EMPTY_CATALOG_FILTER, type CatalogFacets } from '@/lib/merch/catalog-filter-types'
import { listCatalogProductTypeSlugs } from '@/lib/merch/catalog-product-types'
import { BRAND_NAME_KEYS } from '@/lib/merch/preview/brand-names'
import { WORDMARK_STYLE_GROUPS } from '@/lib/merch/preview/wordmark-style-groups'

const baseFacets: CatalogFacets = {
  sources: { 'merch-store': 79, 't-shirts': 6, 'buyer-shop': 195 },
  categories: {
    apparel: 10,
    hats: 16,
    drinkware: 20,
    home: 10,
    'wall-art': 10,
    bags: 10,
    'tech-desk': 10,
    pets: 5,
    kids: 5,
    outdoor: 5,
    accessories: 5,
  },
  productTypes: { tee: 5, hat: 12, 'home-faith': 3 },
  availability: { buyable: 274, 'coming-soon': 6, 'missing-mockup': 8 },
  designs: { freeplug: 200, custom: 195 },
  colors: { Black: 50, White: 40 },
  sizes: { M: 30, L: 30 },
  priceMinCents: 999,
  priceMaxCents: 9999,
  total: 280,
}

function assertNoRawI18nKeys(container: HTMLElement) {
  const text = container.textContent ?? ''
  expect(text).not.toMatch(/\bpublic\./)
  expect(text).not.toMatch(/catalogFilter\./)
}

function lookup(messages: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), messages)
}

describe('CatalogFilterPanel i18n', () => {
  beforeEach(() => setTestLocale('en'))

  it('renders EN labels without raw message keys', () => {
    const { container } = render(
      <CatalogFilterPanel
        scope="all-merch"
        panelFacets={baseFacets}
        state={EMPTY_CATALOG_FILTER}
        onChange={() => {}}
        onClear={() => {}}
      />
    )
    expect(screen.getByText('Merch store')).toBeTruthy()
    expect(screen.getByText('Buyable now')).toBeTruthy()
    expect(screen.getByText('Freeplug logo')).toBeTruthy()
    assertNoRawI18nKeys(container)
  })

  it('renders ES labels without raw message keys', () => {
    setTestLocale('es')
    const { container } = render(
      <CatalogFilterPanel
        scope="all-merch"
        panelFacets={baseFacets}
        state={EMPTY_CATALOG_FILTER}
        onChange={() => {}}
        onClear={() => {}}
      />
    )
    expect(screen.getByText('Tienda de mercancía')).toBeTruthy()
    expect(screen.getByText('Comprar ahora')).toBeTruthy()
    assertNoRawI18nKeys(container)
  })

  it('shows Supreme look and style facets when wordmark counts are provided', () => {
    const brandNames = Object.fromEntries(BRAND_NAME_KEYS.map((k) => [k, 4])) as Record<(typeof BRAND_NAME_KEYS)[number], number>
    const styles = Object.fromEntries(WORDMARK_STYLE_GROUPS.map((k) => [k, 10])) as Record<(typeof WORDMARK_STYLE_GROUPS)[number], number>
  const { container } = render(
      <CatalogFilterPanel
        scope="shop"
        panelFacets={baseFacets}
        previewWordmarkFacets={{ brandNames, supremeLook: 120, styles }}
        state={EMPTY_CATALOG_FILTER}
        onChange={() => {}}
        onClear={() => {}}
      />
    )
    expect(screen.getByText('Supreme look')).toBeTruthy()
    expect(screen.getByText('Box')).toBeTruthy()
    assertNoRawI18nKeys(container)
    setTestLocale('es')
    render(
      <CatalogFilterPanel
        scope="shop"
        panelFacets={baseFacets}
        previewWordmarkFacets={{ brandNames, supremeLook: 120, styles }}
        state={EMPTY_CATALOG_FILTER}
        onChange={() => {}}
        onClear={() => {}}
      />
    )
    expect(screen.getByText('Estilo Supreme')).toBeTruthy()
  })

  it('has a human label in EN and ES for every catalog product type slug', () => {
    for (const slug of listCatalogProductTypeSlugs()) {
      expect(typeof lookup(en, `public.merch.catalogFilter.productTypeLabels.${slug}`)).toBe('string')
      expect(typeof lookup(es, `public.merch.catalogFilter.productTypeLabels.${slug}`)).toBe('string')
    }
  })
})
