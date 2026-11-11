import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import expected from './buyer-wordmark-art-manifest.expected.json'

const PUBLIC_ROOT = join(process.cwd(), 'public')

describe('buyer wordmark art manifest', () => {
  it('has all ingested PNGs on disk', () => {
    for (const publicPath of expected.paths) {
      const disk = join(PUBLIC_ROOT, publicPath.replace(/^\//, ''))
      expect(existsSync(disk), `missing ${publicPath}`).toBe(true)
    }
  })
})
