import { describe, expect, it } from 'vitest'
import { isLocalizedPublicPath } from '@/i18n/routing'
import { enabledLocales } from '@/i18n/gate'
import { isMerchShopEnabled } from '@/lib/merch/flags'

describe('shop public routes', () => {
  it('registers /shop for i18n routing', () => {
    expect(isLocalizedPublicPath('/shop')).toBe(true)
    expect(isLocalizedPublicPath('/shop/foo')).toBe(true)
    expect(isLocalizedPublicPath('/es/shop')).toBe(enabledLocales().includes('es'))
  })

  it('is gated off unless MERCH_SHOP_ENABLED=true', () => {
    expect(isMerchShopEnabled({ MERCH_SHOP_ENABLED: 'false' })).toBe(false)
  })
})
