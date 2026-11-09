import { describe, expect, it } from 'vitest'
import { isMerchShopEnabled } from '../flags'

describe('MERCH_SHOP_ENABLED', () => {
  it('defaults off', () => {
    expect(isMerchShopEnabled({})).toBe(false)
    expect(isMerchShopEnabled({ MERCH_SHOP_ENABLED: 'false' })).toBe(false)
    expect(isMerchShopEnabled({ MERCH_SHOP_ENABLED: 'true' })).toBe(true)
  })
})
