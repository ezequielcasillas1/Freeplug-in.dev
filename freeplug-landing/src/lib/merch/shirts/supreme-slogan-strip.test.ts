import { describe, expect, it } from 'vitest'
import { getSupremePreviewSpec } from '@/lib/merch/shirts/supreme-preview'
import { supremeSloganStripLayout } from '@/lib/merch/shirts/supreme-slogan-strip'

describe('supremeSloganStripLayout', () => {
  it('keeps Day One strip narrower than chest print width', () => {
    const spec = getSupremePreviewSpec('24-world-day-one')
    expect(spec).toBeTruthy()
    const layout = supremeSloganStripLayout(spec!, 'Black')
    expect(layout.stripW).toBeLessThan(layout.printMaxW)
    expect(layout.stripH).toBeLessThan(layout.printMaxW * 0.28)
  })

  it('does not use full print width for single-line slogans', () => {
    const spec = getSupremePreviewSpec('16-init-running-over')
    expect(spec).toBeTruthy()
    const layout = supremeSloganStripLayout(spec!, 'Black')
    expect(layout.stripW).toBeLessThan(layout.printMaxW * 0.92)
  })
})
