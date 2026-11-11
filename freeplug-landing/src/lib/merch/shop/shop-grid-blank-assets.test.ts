import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { listShopItems } from './catalog'

describe('shop grid blank assets on disk', () => {
  it('has every grid and gallery path in public/', () => {
    const root = path.join(process.cwd(), 'public')
    const missing: string[] = []
    const seen = new Set<string>()
    for (const item of listShopItems()) {
      for (const src of [item.gridImage, ...item.gallery]) {
        if (seen.has(src)) continue
        seen.add(src)
        const file = path.join(root, src.replace(/^\//, ''))
        if (!existsSync(file)) missing.push(src)
      }
    }
    expect(missing).toEqual([])
    expect(seen.size).toBeGreaterThanOrEqual(listShopItems().length)
  })
})
