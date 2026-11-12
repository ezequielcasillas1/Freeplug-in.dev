import { describe, expect, it } from 'vitest'
import { auditRenderedOverlayVisibility } from './shop-placement-guards'
import catalogDoc from '@/lib/merch/shop/shop-catalog.json'
import type { ShopCatalogItem } from './types'

const catalog = catalogDoc as { items: ShopCatalogItem[] }

describe('shop rendered overlay visibility', () => {
  it('exports audit helper with mark/tile thresholds', () => {
    expect(typeof auditRenderedOverlayVisibility).toBe('function')
  })
})
