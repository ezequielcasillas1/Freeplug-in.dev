import { describe, expect, it } from 'vitest'
import { getCatalogProduct, validateCollectionCheckoutLine } from './catalog'
import { GIVING_VERSES_PRODUCT_SLUG, listGivingVerses } from './giving-verses'

describe('giving verses tee', () => {
  it('lists 22 verses from handoff catalog', () => {
    expect(listGivingVerses()).toHaveLength(22)
    expect(listGivingVerses()[0]?.book).toBe('Proverbs 19:17')
  })

  it('catalog entry is preview-only (no Printify product yet)', () => {
    const entry = getCatalogProduct(GIVING_VERSES_PRODUCT_SLUG)!
    expect(entry.checkout_sellable).toBe(false)
    expect(entry.printify_product_id).toBe('')
    expect(entry.options.length).toBeGreaterThan(0)
  })

  it('rejects checkout while sellable is false', () => {
    const v = validateCollectionCheckoutLine({
      collection: 'apparel',
      slug: GIVING_VERSES_PRODUCT_SLUG,
      option_key: 'm-black',
      quantity: 1,
    })
    expect(v.ok).toBe(false)
  })
})
