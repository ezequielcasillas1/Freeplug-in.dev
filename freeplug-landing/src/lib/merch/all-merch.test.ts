import { describe, expect, it } from 'vitest'
import en from '../../../messages/en.json'
import es from '../../../messages/es.json'
import { ALL_MERCH_CATEGORIES, countAllMerchByCategory, listAllMerchItems } from './all-merch'
import { isLocalizedPublicPath, publicHref } from '@/i18n/routing'

function lookup(messages: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), messages)
}

describe('all merch listing', () => {
  const items = listAllMerchItems()

  it('lists every t-shirt, collection product, and shop item once', () => {
    expect(items.filter((i) => i.key.startsWith('tshirts/'))).toHaveLength(39)
    expect(items.filter((i) => i.key.startsWith('shop/'))).toHaveLength(195)
    expect(items.filter((i) => !i.key.startsWith('shop/') && !i.key.startsWith('tshirts/'))).toHaveLength(79)
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length)
  })

  it('marks the six coming-soon shop items', () => {
    expect(items.filter((i) => i.comingSoon)).toHaveLength(6)
    expect(items.filter((i) => i.comingSoon).every((i) => i.href.startsWith('/shop/'))).toBe(true)
  })

  it('puts every item in a known category, and counts add up', () => {
    const counts = countAllMerchByCategory(items)
    expect(items.every((i) => ALL_MERCH_CATEGORIES.includes(i.category))).toBe(true)
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(items.length)
  })

  it('has an image, a price, and a translated title in EN and ES', () => {
    for (const i of items) {
      expect(i.image).toBeTruthy()
      expect(i.fromPriceCents).toBeGreaterThan(0)
      if (i.titleKey) {
        expect(typeof lookup(en, `public.merch.${i.titleKey}`)).toBe('string')
        expect(typeof lookup(es, `public.merch.${i.titleKey}`)).toBe('string')
      }
    }
  })

  it('has EN and ES labels for the page and every category', () => {
    for (const m of [en, es]) {
      for (const k of ['subnav.allMerch', 'subnav.merchHome', 'indexCardAll', 'allMerch.heading', 'allMerch.lead', 'allMerch.showing', 'allMerch.showMore', 'allMerch.categoriesAria']) {
        expect(typeof lookup(m, `public.merch.${k}`)).toBe('string')
      }
      for (const c of ALL_MERCH_CATEGORIES) expect(typeof lookup(m, `public.merch.shop.tabs.${c}`)).toBe('string')
    }
    expect(lookup(es, 'public.merch.allMerch.heading')).toBe('Toda la mercancía')
  })

  it('/merch/all is a localized public path', () => {
    expect(isLocalizedPublicPath('/merch/all')).toBe(true)
    expect(publicHref('/merch/all', 'es')).toBe('/es/merch/all')
  })
})
