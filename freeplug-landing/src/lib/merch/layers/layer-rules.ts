import type { MerchLayer } from './layers'
import { MIND_LAYER_KEYS } from './layer-overrides'

const GIVE_COLLECTION = 'home-faith'

/** Slugs (segment after collection/) or full keys that belong to Give. */
const GIVE_KEY_PATTERNS: RegExp[] = [
  /^home-faith\//,
  /(^|\/)good-measure-longsleeve$/,
  /kjv/i,
  /running-over/i,
  /pressed-down/i,
  /thanksgiving-tea-towel/,
]

/** Explicit Give keys (documentation + future verse wave slots). */
export const GIVE_EXPLICIT_KEYS = [
  'apparel/good-measure-longsleeve',
  'home-faith/running-over-candle',
  'home-faith/running-over-canvas',
  'home-faith/running-over-pillow',
  'home-faith/come-on-in-doormat',
  'home-faith/plugged-ornament',
  'home-faith/kjv-bookmark-1',
  'home-faith/kjv-bookmark-2',
  'home-faith/kjv-bookmark-3',
  'home-faith/kjv-bookmark-4',
  'home-faith/thanksgiving-tea-towel',
  'home-faith/pressed-down-framed',
  'home-faith/running-over-stocking',
  'home-faith/kjv-woven-blanket',
  'home-faith/kjv-serving-tray',
] as const

export function resolveMerchLayerFromKey(key: string): MerchLayer {
  if (MIND_LAYER_KEYS.has(key)) return 'mind'
  if (GIVE_KEY_PATTERNS.some((re) => re.test(key))) return 'give'
  if (key.startsWith(`${GIVE_COLLECTION}/`)) return 'give'
  return 'everyday'
}
