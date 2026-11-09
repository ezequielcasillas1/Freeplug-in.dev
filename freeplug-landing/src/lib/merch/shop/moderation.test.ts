import { describe, expect, it } from 'vitest'
import { moderateShopUploadImage, type WorkersAiRunner } from './moderation'

describe('shop upload moderation', () => {
  it('held when AI unavailable', async () => {
    const r = await moderateShopUploadImage(new Uint8Array([1, 2, 3]), 'image/png', null)
    expect(r.result).toBe('held')
  })

  it('fails high nsfw score', async () => {
    const ai: WorkersAiRunner = {
      run: async (model) => {
        if (model.includes('nsfw')) return { nsfw: 0.99 }
        return { response: 'SAFE' }
      },
    }
    const r = await moderateShopUploadImage(new Uint8Array(10), 'image/png', ai)
    expect(r.result).toBe('fail')
  })

  it('passes low nsfw and SAFE vision', async () => {
    const ai: WorkersAiRunner = {
      run: async (model) => {
        if (model.includes('nsfw')) return { nsfw: 0.01 }
        return { response: 'SAFE' }
      },
    }
    const r = await moderateShopUploadImage(new Uint8Array(10), 'image/png', ai)
    expect(r.result).toBe('pass')
  })
})
