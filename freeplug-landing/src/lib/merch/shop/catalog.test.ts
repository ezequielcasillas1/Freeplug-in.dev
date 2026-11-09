import { describe, expect, it } from 'vitest'
import { getShopItem, listShopItems, shopItemCount, validateShopCheckoutLine } from './catalog'
import { printifyProductIdForVariant } from './printify-catalog'

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

  it('accepts custom pending_review line without printify product id', () => {
    const item = getShopItem(listFirstSlug())
    const res = validateShopCheckoutLine(
      {
        slug: item!.slug,
        variant_id: item!.variants[0]?.id,
        quantity: 1,
        design_mode: 'custom',
        custom_upload_path: 'merch-shop-uploads/test.png',
        rights_confirmed: true,
      },
      500
    )
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.line.designMode).toBe('custom')
      expect(res.line.unitAmountCents).toBe(item!.variants[0]!.retailCents + 500)
    }
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
