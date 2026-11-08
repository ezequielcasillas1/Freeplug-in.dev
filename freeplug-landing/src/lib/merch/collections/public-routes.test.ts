import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FREEPLUG_I18N_ES = 'on'
})
import { listMerchCollectionPublicPaths, listMerchCollections, listCatalogProducts } from './catalog'
import { isLocalizedPublicPath, publicHref } from '@/i18n/routing'

const routeTestBase = process.env.MERCH_ROUTE_TEST_BASE?.replace(/\/$/, '')

describe('merch collection public paths', () => {
  it('lists 5 collections and 22 products', () => {
    expect(listMerchCollections()).toHaveLength(5)
    expect(listCatalogProducts()).toHaveLength(22)
    const paths = listMerchCollectionPublicPaths()
    expect(paths).toHaveLength(5 + 22)
  })

  it('registers EN and ES paths for locale proxy and builds Spanish hrefs', () => {
    for (const path of listMerchCollectionPublicPaths()) {
      expect(isLocalizedPublicPath(path)).toBe(true)
      expect(isLocalizedPublicPath(`/es${path}`)).toBe(true)
      expect(publicHref(path, 'es')).toBe(`/es${path}`)
    }
  })
})

describe.runIf(routeTestBase)('merch collection HTTP status', () => {
  for (const path of listMerchCollectionPublicPaths()) {
    it(`GET ${path}`, async () => {
      const res = await fetch(`${routeTestBase}${path}`, { redirect: 'follow' })
      expect(res.status).toBe(200)
    })
    it(`GET /es${path}`, async () => {
      const res = await fetch(`${routeTestBase}/es${path}`, { redirect: 'follow' })
      expect(res.status).toBe(200)
    })
  }
})
