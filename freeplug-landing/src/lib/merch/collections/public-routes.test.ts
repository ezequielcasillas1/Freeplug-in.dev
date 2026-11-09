import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FREEPLUG_I18N_ES = 'on'
})
import shirtsCatalog from '../shirts/shirts-catalog.json'
import { listMerchCollectionPublicPaths, listMerchCollections, listCatalogProducts } from './catalog'
import { isLocalizedPublicPath, publicHref } from '@/i18n/routing'

const routeTestBase = (process.env.MERCH_PROD_TEST_BASE ?? process.env.MERCH_ROUTE_TEST_BASE)?.replace(/\/$/, '')

const CORE_PATHS = [
  '/',
  '/merch',
  '/merch/t-shirts',
  ...(shirtsCatalog as { slug: string }[]).map((s) => `/merch/t-shirts/${s.slug}`),
]

function isProductPage(path: string): boolean {
  return path.split('/').length > 3
}

describe('merch collection public paths', () => {
  it('lists 11 collections and 79 products', () => {
    expect(listMerchCollections()).toHaveLength(11)
    expect(listCatalogProducts()).toHaveLength(79)
    const paths = listMerchCollectionPublicPaths()
    expect(paths).toHaveLength(11 + 79)
  })

  it('registers EN and ES paths for locale proxy and builds Spanish hrefs', () => {
    for (const path of listMerchCollectionPublicPaths()) {
      expect(isLocalizedPublicPath(path)).toBe(true)
      expect(isLocalizedPublicPath(`/es${path}`)).toBe(true)
      expect(publicHref(path, 'es')).toBe(`/es${path}`)
    }
  })
})

describe.runIf(routeTestBase)('merch HTTP status (production or dev server)', () => {
  const paths = [...listMerchCollectionPublicPaths(), ...CORE_PATHS]

  for (const path of paths) {
    it(`GET ${path}`, async () => {
      const res = await fetch(`${routeTestBase}${path}`, { redirect: 'follow' })
      const html = await res.text()
      expect(res.status).toBe(200)
      if (path.includes('/merch/t-shirts/') && path.split('/').length > 3) {
        expect(html).toMatch(/Buy shirt|Comprar camiseta/)
      } else if (isProductPage(path) && path.includes('/merch/') && !path.includes('t-shirts')) {
        expect(html).toMatch(/Buy now|Comprar/)
      }
    })
    it(`GET /es${path === '/' ? '' : path}`, async () => {
      const esPath = path === '/' ? '/es' : `/es${path}`
      const res = await fetch(`${routeTestBase}${esPath}`, { redirect: 'follow' })
      const html = await res.text()
      expect(res.status).toBe(200)
      if (path.includes('/merch/t-shirts/') && path.split('/').length > 3) {
        expect(html).toMatch(/Buy shirt|Comprar camiseta/)
      } else if (isProductPage(path) && path.includes('/merch/') && !path.includes('t-shirts')) {
        expect(html).toMatch(/Buy now|Comprar/)
      }
    })
  }
})
