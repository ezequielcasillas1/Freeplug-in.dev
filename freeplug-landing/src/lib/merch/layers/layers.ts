/** Merch design layers: Everyday, Give, Mind (single source of truth). */
export const MERCH_LAYERS = ['everyday', 'give', 'mind'] as const
export type MerchLayer = (typeof MERCH_LAYERS)[number]

/** Owner-approved English names; Spanish labels proposed in PR for sign-off. */
export const MERCH_LAYER_LABEL_EN: Record<MerchLayer, string> = {
  everyday: 'Everyday',
  give: 'Give',
  mind: 'Mind',
}

/** Proposed Spanish nav labels (owner sign-off pending). */
export const MERCH_LAYER_LABEL_ES_PROPOSED: Record<MerchLayer, string> = {
  everyday: 'Día a día',
  give: 'Dar',
  mind: 'Mente',
}

export const MERCH_LAYER_PUBLIC_PATH: Record<MerchLayer, string> = {
  everyday: '/merch/everyday',
  give: '/merch/give',
  mind: '/merch/mind',
}

export const MERCH_LAYER_ROUND_ROBIN_ORDER: readonly MerchLayer[] = ['everyday', 'give', 'mind']

/** Fraction above this triggers a balance warning (does not fail builds). */
export const MERCH_LAYER_BALANCE_WARN_THRESHOLD = 0.4
