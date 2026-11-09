/**
 * Custom upload moderation via Cloudflare Workers AI.
 *
 * One deciding model: `@cf/llava-hf/llava-1.5-7b-hf` with a safety prompt (nudity/sexual content,
 * violence, hate symbols, obvious trademark misuse). Fail-safe: a missing binding, any model error,
 * or any answer other than a clear SAFE leaves the upload held for review.
 *
 * Documented for operators in docs/MERCH-SHOP-CUSTOM-HANDSOFF.md.
 */
export const SHOP_MODERATION_MODEL_VISION = '@cf/llava-hf/llava-1.5-7b-hf'

export type ShopModerationResult = 'pass' | 'fail' | 'held'

export type ShopModerationDetail = {
  visionLabel?: string
  visionRaw?: string
  reason?: string
}

export type WorkersAiRunner = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

const VISION_PROMPT =
  'You are a content safety reviewer for custom print-on-demand artwork. Reply with exactly one word: SAFE, UNSAFE, or UNCERTAIN. UNSAFE if the image shows nudity, sexual content, graphic violence or gore, hate symbols, or an obvious well-known brand logo or trademark. Otherwise SAFE unless you genuinely cannot tell, then UNCERTAIN.'

function labelFromVisionOutput(out: unknown): string {
  if (typeof out === 'string') return out.trim().toUpperCase()
  if (typeof out === 'object' && out && 'description' in out) return String((out as { description: unknown }).description).trim().toUpperCase()
  if (typeof out === 'object' && out && 'response' in out) return String((out as { response: unknown }).response).trim().toUpperCase()
  return ''
}

export async function moderateShopUploadImage(
  bytes: Uint8Array,
  _mime: string,
  ai: WorkersAiRunner | null
): Promise<{ result: ShopModerationResult; detail: ShopModerationDetail }> {
  if (!ai) {
    return { result: 'held', detail: { reason: 'moderation_unavailable' } }
  }

  let visionLabel = ''
  try {
    const visionOut = await ai.run(SHOP_MODERATION_MODEL_VISION, {
      image: [...bytes],
      prompt: VISION_PROMPT,
      max_tokens: 16,
    })
    visionLabel = labelFromVisionOutput(visionOut)
  } catch {
    return { result: 'held', detail: { reason: 'vision_model_error' } }
  }

  const raw = visionLabel.slice(0, 200)
  const word = visionLabel.replace(/[^A-Z]+/g, ' ').trim().split(' ')[0] ?? ''
  if (/UNSAFE/.test(visionLabel)) {
    return { result: 'fail', detail: { visionLabel: word, visionRaw: raw, reason: 'vision_unsafe' } }
  }
  if (word === 'SAFE' && !/UNCERTAIN/.test(visionLabel)) {
    return { result: 'pass', detail: { visionLabel: word, visionRaw: raw, reason: 'vision_safe' } }
  }
  return {
    result: 'held',
    detail: { visionLabel: word, visionRaw: raw, reason: word === 'UNCERTAIN' ? 'borderline' : 'inconclusive' },
  }
}
