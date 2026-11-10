import type { MerchLayer } from './layers'
import { LAYER_KEY_OVERRIDES } from './layer-overrides'
import { resolveMerchLayerFromKey } from './layer-rules'

export function attachMerchLayer(key: string): MerchLayer {
  return LAYER_KEY_OVERRIDES[key] ?? resolveMerchLayerFromKey(key)
}
