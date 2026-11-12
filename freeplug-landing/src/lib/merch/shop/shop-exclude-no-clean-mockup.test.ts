import { describe, expect, it, vi, afterEach } from 'vitest'
import { listShopFilterItems } from './shop-filter-items'
import { shopNoCleanMockupSlugs } from './shop-exclude-no-clean-mockup'

describe('shopExcludeNoCleanMockup', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('default omits no-clean slugs from the grid list', () => {
    vi.unstubAllEnvs()
    const keys = new Set(listShopFilterItems().map((i) => i.key))
    expect(keys.has('shop/12-solid-cuffed-beanie-5665')).toBe(false)
    expect(keys.has('shop/kiss-cut-stickers-400')).toBe(false)
  })

  it('when SHOP_EXCLUDE_NO_CLEAN_MOCKUP=false, keeps no-clean slugs in list', () => {
    vi.stubEnv('SHOP_EXCLUDE_NO_CLEAN_MOCKUP', 'false')
    const keys = new Set(listShopFilterItems().map((i) => i.key))
    expect(keys.has('shop/12-solid-cuffed-beanie-5665')).toBe(true)
  })

  it('when default on, omits every slug from shop-no-clean-mockup.json', () => {
    vi.unstubAllEnvs()
    const keys = new Set(listShopFilterItems().map((i) => i.key.replace(/^shop\//, '')))
    for (const slug of shopNoCleanMockupSlugs()) {
      expect(keys.has(slug)).toBe(false)
    }
  })
})
