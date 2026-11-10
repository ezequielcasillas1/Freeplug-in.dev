import { describe, expect, it } from 'vitest'
import { shirtFrontMockupForPreview } from '@/lib/merch/shirts/supreme-blank-mockup'

describe('supreme blank mockup paths (deprecated)', () => {
  it('is not used when useBlankSupreme is false', () => {
    const p = shirtFrontMockupForPreview('11-init-open-hand-give', 'Black', { useBlankSupreme: false })
    expect(p).not.toContain('-blank-front')
    expect(p).toContain('11-init-open-hand-give-black-front.jpg')
  })
})
