import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FONT_BUNDLE_STYLE_COUNT, FONT_BUNDLE_STYLES } from './product'

const previewDir = join(__dirname, '..', '..', '..', 'public', 'fonts', 'merch-preview')

describe('merch font bundle catalog', () => {
  it('lists 12 styles across the three families', () => {
    expect(FONT_BUNDLE_STYLE_COUNT).toBe(12)
    expect(FONT_BUNDLE_STYLES).toHaveLength(3)
    expect(FONT_BUNDLE_STYLES[0]).toContain('Outline')
    expect(FONT_BUNDLE_STYLES[1]).toContain('Condensed Headline')
    expect(FONT_BUNDLE_STYLES[2]).toContain('Bold')
  })
})

describe('merch preview woff2 (basic Latin subset)', () => {
  const files = [
    'FreeplugDispatch-Regular.woff2',
    'FreeplugDispatch-Bold.woff2',
    'FreeplugDispatch-CondensedHeadline.woff2',
    'FPCursiveDemo-Regular.woff2',
    'FPExtendedDemo-Regular.woff2',
  ]

  it.each(files)('%s is committed and non-empty', (name) => {
    const buf = readFileSync(join(previewDir, name))
    expect(buf.byteLength).toBeGreaterThan(1000)
    expect(buf.byteLength).toBeLessThan(25_000)
    expect(buf.subarray(0, 4).toString()).toBe('wOF2')
  })
})
