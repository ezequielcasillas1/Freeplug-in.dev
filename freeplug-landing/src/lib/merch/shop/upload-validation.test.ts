import { describe, expect, it } from 'vitest'
import {
  effectiveDpi,
  isDpiWarning,
  parseDataUrlDimensions,
  validateMerchShopUploadMime,
  validateMerchShopUploadSize,
} from './upload-validation'

describe('shop upload validation', () => {
  it('allows png/jpeg/svg mime types', () => {
    expect(validateMerchShopUploadMime('image/png')).toBe(true)
    expect(validateMerchShopUploadMime('image/jpeg')).toBe(true)
    expect(validateMerchShopUploadMime('image/svg+xml')).toBe(true)
    expect(validateMerchShopUploadMime('application/pdf')).toBe(false)
  })

  it('enforces size bounds', () => {
    expect(validateMerchShopUploadSize(100)).toBe(true)
    expect(validateMerchShopUploadSize(20_000_000)).toBe(false)
  })

  it('warns under 150 dpi', () => {
    expect(isDpiWarning(effectiveDpi(300, 300, 10, 10))).toBe(true)
    expect(isDpiWarning(effectiveDpi(2000, 2000, 10, 10))).toBe(false)
  })

  it('parses png data url dimensions', () => {
    const onePixelPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const dims = parseDataUrlDimensions(onePixelPng)
    expect(dims?.width).toBe(1)
    expect(dims?.height).toBe(1)
  })
})
