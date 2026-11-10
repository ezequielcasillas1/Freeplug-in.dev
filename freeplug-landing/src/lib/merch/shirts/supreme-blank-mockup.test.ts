import { describe, expect, it } from 'vitest'
import { isSupremeStyleShirtSlug } from '@/lib/merch/shirts/supreme-preview'
import { shirtFrontMockupForPreview } from '@/lib/merch/shirts/supreme-blank-mockup'

describe('supreme blank mockup paths', () => {
  it('uses -blank-front for supreme preview slugs', () => {
    expect(isSupremeStyleShirtSlug('11-init-open-hand-give')).toBe(true)
    const p = shirtFrontMockupForPreview('11-init-open-hand-give', 'Black', { useBlankSupreme: true })
    expect(p).toContain('-blank-front.jpg')
  })

  it('keeps normal mockups for giving tees', () => {
    const p = shirtFrontMockupForPreview('03-get-plugged-in', 'Black', { useBlankSupreme: true })
    expect(p).not.toContain('-blank-front')
  })
})
