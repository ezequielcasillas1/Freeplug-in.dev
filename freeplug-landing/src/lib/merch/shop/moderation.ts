/**
 * Custom upload moderation via Cloudflare Workers AI.
 *
 * Primary model: `@cf/huggingface/nsfw-image-detection` (NSFW / sexual content).
 * Secondary: `@cf/llava-hf/llava-1.5-7b-hf` vision prompt for violence, hate symbols, and obvious trademark misuse.
 *
 * Documented for operators in docs/MERCH-SHOP-CUSTOM-HANDSOFF.md.
 */
export const SHOP_MODERATION_MODEL_NSFW = '@cf/huggingface/nsfw-image-detection'
export const SHOP_MODERATION_MODEL_VISION = '@cf/llava-hf/llava-1.5-7b-hf'

export type ShopModerationResult = 'pass' | 'fail' | 'held'

export type ShopModerationDetail = {
  nsfwScore?: number
  visionLabel?: string
  visionRaw?: string
  reason?: string
}

export type WorkersAiRunner = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

const VISION_PROMPT =
  'You are a content safety reviewer for custom print-on-demand artwork. Reply with exactly one word: SAFE, UNSAFE, or UNCERTAIN. UNSAFE if the image shows nudity, sexual content, graphic violence or gore, hate symbols, or an obvious well-known brand logo or trademark. Otherwise SAFE unless you genuinely cannot tell, then UNCERTAIN.'

function scoreFromNsfwOutput(out: unknown): number | null {
  if (typeof out !== 'object' || !out) return null
  const o = out as Record<string, unknown>
  if (typeof o.nsfw === 'number') return o.nsfw
  if (typeof o.score === 'number') return o.score
  if (Array.isArray(o)) {
    const first = o[0]
    if (typeof first === 'object' && first && 'score' in first) return Number((first as { score: unknown }).score)
  }
  if (typeof o.result === 'object' && o.result) {
    const r = o.result as Record<string, unknown>
    if (typeof r.nsfw === 'number') return r.nsfw
  }
  return null
}

function labelFromVisionOutput(out: unknown): string {
  if (typeof out === 'string') return out.trim().toUpperCase()
  if (typeof out === 'object' && out && 'description' in out) return String((out as { description: unknown }).description).trim().toUpperCase()
  if (typeof out === 'object' && out && 'response' in out) return String((out as { response: unknown }).response).trim().toUpperCase()
  return ''
}

export async function moderateShopUploadImage(
  bytes: Uint8Array,
  mime: string,
  ai: WorkersAiRunner | null
): Promise<{ result: ShopModerationResult; detail: ShopModerationDetail }> {
  if (!ai) {
    return { result: 'held', detail: { reason: 'moderation_unavailable' } }
  }

  const image = [...bytes]
  let nsfwScore: number | null = null
  try {
    const nsfwOut = await ai.run(SHOP_MODERATION_MODEL_NSFW, { image })
    nsfwScore = scoreFromNsfwOutput(nsfwOut)
  } catch {
    return { result: 'held', detail: { reason: 'nsfw_model_error' } }
  }

  if (nsfwScore != null && nsfwScore >= 0.85) {
    return { result: 'fail', detail: { nsfwScore, reason: 'nsfw_high' } }
  }

  let visionLabel = ''
  try {
    const visionOut = await ai.run(SHOP_MODERATION_MODEL_VISION, {
      image,
      prompt: VISION_PROMPT,
      max_tokens: 16,
    })
    visionLabel = labelFromVisionOutput(visionOut)
  } catch {
    visionLabel = 'UNCERTAIN'
  }

  const detail: ShopModerationDetail = { nsfwScore: nsfwScore ?? undefined, visionLabel, visionRaw: visionLabel }

  if (/UNSAFE/.test(visionLabel)) {
    return { result: 'fail', detail: { ...detail, reason: 'vision_unsafe' } }
  }
  if (/UNCERTAIN/.test(visionLabel) || (nsfwScore != null && nsfwScore >= 0.35 && nsfwScore < 0.85)) {
    return { result: 'held', detail: { ...detail, reason: 'borderline' } }
  }
  if (nsfwScore != null && nsfwScore < 0.35 && /SAFE/.test(visionLabel)) {
    return { result: 'pass', detail: { ...detail, reason: 'clear_pass' } }
  }
  if (/SAFE/.test(visionLabel)) return { result: 'pass', detail: { ...detail, reason: 'vision_safe' } }
  return { result: 'held', detail: { ...detail, reason: 'inconclusive' } }
}
