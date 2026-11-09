import { describe, expect, it } from 'vitest'
import { moderateShopUploadImage, SHOP_MODERATION_MODEL_VISION, type WorkersAiRunner } from './moderation'

function aiReturning(out: unknown): WorkersAiRunner & { models: string[] } {
  const models: string[] = []
  return {
    models,
    run: async (model) => {
      models.push(model)
      return out
    },
  }
}

describe('shop upload moderation', () => {
  it('held when AI unavailable', async () => {
    const r = await moderateShopUploadImage(new Uint8Array([1, 2, 3]), 'image/png', null)
    expect(r.result).toBe('held')
  })

  it('uses only the llava vision model', async () => {
    const ai = aiReturning({ description: 'SAFE' })
    await moderateShopUploadImage(new Uint8Array(10), 'image/png', ai)
    expect(ai.models).toEqual([SHOP_MODERATION_MODEL_VISION])
  })

  it('passes a clear SAFE answer (description or response)', async () => {
    expect((await moderateShopUploadImage(new Uint8Array(10), 'image/png', aiReturning({ description: ' SAFE' }))).result).toBe('pass')
    expect((await moderateShopUploadImage(new Uint8Array(10), 'image/png', aiReturning({ response: 'Safe.' }))).result).toBe('pass')
  })

  it('fails an UNSAFE answer', async () => {
    const r = await moderateShopUploadImage(new Uint8Array(10), 'image/png', aiReturning({ description: 'UNSAFE' }))
    expect(r.result).toBe('fail')
  })

  it('holds UNCERTAIN, empty, or unexpected answers', async () => {
    for (const out of [{ description: 'UNCERTAIN' }, { description: '' }, { description: 'I think it is a logo' }, null, 42]) {
      const r = await moderateShopUploadImage(new Uint8Array(10), 'image/png', aiReturning(out))
      expect(r.result).toBe('held')
    }
  })

  it('holds when the model throws', async () => {
    const ai: WorkersAiRunner = {
      run: async () => {
        throw new Error('model down')
      },
    }
    const r = await moderateShopUploadImage(new Uint8Array(10), 'image/png', ai)
    expect(r.result).toBe('held')
    expect(r.detail.reason).toBe('vision_model_error')
  })
})
