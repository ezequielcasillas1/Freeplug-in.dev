import type { MerchLayer } from './layers'

/** Per-key overrides (Mind wave, one-off fixes). Prefer rules in layer-rules.ts when possible. */
export const LAYER_KEY_OVERRIDES: Partial<Record<string, MerchLayer>> = {}

/** Mind illusion / puzzle designs (extend as SKUs land). */
export const MIND_LAYER_KEYS = new Set<string>([
  // e.g. 'wall-art/poster-optical-1'
])
