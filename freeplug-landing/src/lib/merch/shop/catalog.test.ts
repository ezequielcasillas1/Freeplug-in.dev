import { describe, expect, it, beforeAll } from 'vitest'
import { getShopItem, listShopItems, shopItemCount, validateShopCheckoutLine } from './catalog'
import { signShopUploadToken } from './upload-token'
import { customOrdersCapReached } from './daily-cap'
import { printifyProductIdForVariant } from './printify-catalog'

beforeAll(() => {
  process.env.MERCH_SHOP_UPLOAD_SIGNING_SECRET = 'test-upload-signing'
})

describe('shop catalog', () => {
  it('loads 195 research items', () => {
    expect(shopItemCount()).toBe(195)
  })

  it('rejects client price fields implicitly by validating server lines', () => {
    const item = getShopItem(listFirstSlug())
    expect(item).not.toBeNull()
    const custom = validateShopCheckoutLine(
      {
        slug: item!.slug,
        variant_id: item!.variants[0]?.id,
        quantity: 1,
        design_mode: 'custom',
        custom_upload_path: 'merch-shop-uploads/test.png',
        rights_confirmed: false,
      },
      0
    )
    expect(custom.ok).toBe(false)
    if (!custom.ok) expect(custom.error).toMatch(/Rights/)
  })

  it('requires printify product id for freeplug checkout', () => {
    const item = getShopItem('fanny-pack-468')
    expect(item).not.toBeNull()
    const res = validateShopCheckoutLine(
      {
        slug: item!.slug,
        variant_id: item!.variants[0]?.id,
        quantity: 1,
        design_mode: 'freeplug',
      },
      0
    )
    expect(res.ok).toBe(false)
  })

  it('accepts custom line with valid upload token', () => {
    const item = getShopItem(listFirstSlug())
    const path = 'merch-shop-uploads/test.png'
    const token = signShopUploadToken({
      path,
      moderation: 'pass',
      slug: item!.slug,
      variantId: item!.variants[0]!.id,
      width: 3000,
      height: 3000,
      exp: Date.now() + 60_000,
    })
    const res = validateShopCheckoutLine(
      {
        slug: item!.slug,
        variant_id: item!.variants[0]?.id,
        quantity: 1,
        design_mode: 'custom',
        custom_upload_path: path,
        rights_confirmed: true,
        upload_token: token,
      },
      0
    )
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.line.designMode).toBe('custom')
      expect(res.line.unitAmountCents).toBe(item!.variants[0]!.retailCents)
    }
  })

  it('blocks custom checkout when daily cap reached', () => {
    const item = getShopItem(listFirstSlug())
    expect(customOrdersCapReached(20)).toBe(true)
    const path = 'merch-shop-uploads/test.png'
    const token = signShopUploadToken({
      path,
      moderation: 'pass',
      slug: item!.slug,
      variantId: item!.variants[0]!.id,
      width: 3000,
      height: 3000,
      exp: Date.now() + 60_000,
    })
    const res = validateShopCheckoutLine(
      {
        slug: item!.slug,
        variant_id: item!.variants[0]?.id,
        quantity: 1,
        design_mode: 'custom',
        custom_upload_path: path,
        rights_confirmed: true,
        upload_token: token,
      },
      20
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/sold out/i)
  })

  it('accepts freeplug line when variant maps to a printify product', () => {
    const item = getShopItem(listFirstSlug())
    const vid = item!.variants[0]!.id
    expect(printifyProductIdForVariant(item!.slug, vid)).toBeTruthy()
    const res = validateShopCheckoutLine(
      {
        slug: item!.slug,
        variant_id: vid,
        quantity: 1,
        design_mode: 'freeplug',
      },
      0
    )
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.line.printifyProductId).toBeTruthy()
  })
})

function listFirstSlug(): string {
  return listShopItems()[0]!.slug
}
