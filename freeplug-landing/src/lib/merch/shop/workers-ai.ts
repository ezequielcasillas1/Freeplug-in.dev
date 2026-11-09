import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { WorkersAiRunner } from './moderation'
import type { ImagesBindingLike } from '@/lib/outreach/image-codec-cloudflare'

export type AiBindingLike = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

export async function getShopModerationAiRunner(): Promise<WorkersAiRunner | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const ai = (env as { AI?: AiBindingLike }).AI
    if (!ai?.run) return null
    return {
      run: (model, input) => ai.run(model, input),
    }
  } catch {
    return null
  }
}

/** Cloudflare Images binding, used only to downscale the moderation copy of an upload. */
export async function getShopModerationImages(): Promise<ImagesBindingLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const images = (env as { IMAGES?: ImagesBindingLike }).IMAGES
    return images?.input ? images : null
  } catch {
    return null
  }
}
