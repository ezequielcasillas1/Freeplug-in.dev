import { describe, expect, it } from 'vitest'
import { buyerWordmarkArtPublicPath, parseBuyerWordmarkVariationId } from './buyer-wordmark-art-paths'

describe('buyer wordmark art paths', () => {
  it('maps ink rule: dark garment uses on-dark art', () => {
    expect(buyerWordmarkArtPublicPath('cursive', 'freeplug-dev', 'dark')).toBe(
      '/merch/buyer-wordmark-art/cursive/Freeplug.dev-on-dark.png'
    )
    expect(buyerWordmarkArtPublicPath('pop-plate-v2', 'fplgn', 'light')).toBe(
      '/merch/buyer-wordmark-art/pop-plate-v2/FPLGN-on-light.png'
    )
  })

  it('parses buyer variation ids', () => {
    expect(parseBuyerWordmarkVariationId('buyer-pop-v2-freeplug-in')).toEqual({
      style: 'pop-v2',
      brand: 'freeplug-in',
    })
  })
})
