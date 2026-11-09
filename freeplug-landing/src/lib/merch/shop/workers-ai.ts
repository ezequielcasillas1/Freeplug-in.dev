import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { WorkersAiRunner } from './moderation'

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
