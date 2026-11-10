import type { BrandNameKey } from './brand-names'

/** Visual treatment archetypes (Supreme-inspired). */
export type WordmarkTreatment =
  | 'red-box-script'
  | 'white-invert-box'
  | 'outline-hollow-box'
  | 'stacked-two-line'
  | 'slanted-italic-box'
  | 'chest-left-mini-box'
  | 'wide-stretched'
  | 'stamp-badge'
  | 'underline-accent'
  | 'charcoal-box-dispatch'
  | 'code-mono-panel'
  | 'inverted-white-panel'
  | 'outline-text-only'
  | 'double-strike'
  | 'red-box-dispatch'
  | 'corner-ribbon'
  | 'wide-tracking-caps'
  | 'script-float'
  | 'split-dot-badge'
  | 'dash-border-stamp'
  | 'thick-outline-box'
  | 'vertical-stack-tight'
  | 'mono-brackets'
  | 'accent-bar-left'
  | 'condensed-red-fill'
  | 'pill-outline'

export type WordmarkVariationDef = {
  id: string
  nameKey: BrandNameKey
  treatment: WordmarkTreatment
  /** Human label for reports / contact sheet */
  treatmentLabel: string
}

/** 26 preview-only treatments (~4–5 per brand name). */
export const WORDMARK_VARIATIONS: WordmarkVariationDef[] = [
  { id: 'v01-fpid-code-panel', nameKey: 'freeplug-in-dev', treatment: 'code-mono-panel', treatmentLabel: 'Code mono panel' },
  { id: 'v02-fpid-invert-white', nameKey: 'freeplug-in-dev', treatment: 'inverted-white-panel', treatmentLabel: 'Inverted white panel' },
  { id: 'v03-fpid-outline', nameKey: 'freeplug-in-dev', treatment: 'outline-text-only', treatmentLabel: 'Outline text' },
  { id: 'v04-fpid-underline', nameKey: 'freeplug-in-dev', treatment: 'underline-accent', treatmentLabel: 'Underline accent' },
  { id: 'v05-fpid-mono-brackets', nameKey: 'freeplug-in-dev', treatment: 'mono-brackets', treatmentLabel: 'Mono brackets' },
  { id: 'v06-fp-red-cursive', nameKey: 'freeplug', treatment: 'red-box-script', treatmentLabel: 'Red box + script' },
  { id: 'v07-fp-white-invert', nameKey: 'freeplug', treatment: 'white-invert-box', treatmentLabel: 'White invert box' },
  { id: 'v08-fp-outline-box', nameKey: 'freeplug', treatment: 'outline-hollow-box', treatmentLabel: 'Outline hollow box' },
  { id: 'v09-fp-slanted', nameKey: 'freeplug', treatment: 'slanted-italic-box', treatmentLabel: 'Slanted italic box' },
  { id: 'v10-fp-stamp', nameKey: 'freeplug', treatment: 'stamp-badge', treatmentLabel: 'Stamp badge' },
  { id: 'v11-fp-script-float', nameKey: 'freeplug', treatment: 'script-float', treatmentLabel: 'Script float' },
  { id: 'v12-fplgn-wide', nameKey: 'freeplugin', treatment: 'wide-stretched', treatmentLabel: 'Wide extended' },
  { id: 'v13-fplgn-stacked', nameKey: 'freeplugin', treatment: 'stacked-two-line', treatmentLabel: 'Stacked two-line' },
  { id: 'v14-fplgn-strike', nameKey: 'freeplugin', treatment: 'double-strike', treatmentLabel: 'Strike accent' },
  { id: 'v15-fplgn-charcoal', nameKey: 'freeplugin', treatment: 'charcoal-box-dispatch', treatmentLabel: 'Charcoal dispatch box' },
  { id: 'v16-fplgn-tracking', nameKey: 'freeplugin', treatment: 'wide-tracking-caps', treatmentLabel: 'Wide tracking caps' },
  { id: 'v17-fpd-stacked-dot', nameKey: 'freeplug-dev', treatment: 'split-dot-badge', treatmentLabel: 'Stacked .dev badge' },
  { id: 'v18-fpd-red-box', nameKey: 'freeplug-dev', treatment: 'red-box-dispatch', treatmentLabel: 'Red dispatch box' },
  { id: 'v19-fpd-chest-left', nameKey: 'freeplug-dev', treatment: 'chest-left-mini-box', treatmentLabel: 'Chest-left mini' },
  { id: 'v20-fpd-vertical', nameKey: 'freeplug-dev', treatment: 'vertical-stack-tight', treatmentLabel: 'Vertical stack' },
  { id: 'v21-fpin-outline', nameKey: 'freeplug-in', treatment: 'outline-text-only', treatmentLabel: 'Outline .in' },
  { id: 'v22-fpin-thick-box', nameKey: 'freeplug-in', treatment: 'thick-outline-box', treatmentLabel: 'Thick outline box' },
  { id: 'v23-fpin-pill', nameKey: 'freeplug-in', treatment: 'pill-outline', treatmentLabel: 'Pill outline' },
  { id: 'v24-fpin-accent-bar', nameKey: 'freeplug-in', treatment: 'accent-bar-left', treatmentLabel: 'Accent bar left' },
  { id: 'v25-fplgn-stamp', nameKey: 'fplgn', treatment: 'dash-border-stamp', treatmentLabel: 'Dash border stamp' },
  { id: 'v26-fplgn-condensed-red', nameKey: 'fplgn', treatment: 'condensed-red-fill', treatmentLabel: 'Condensed red fill' },
  { id: 'v27-fplgn-tracking', nameKey: 'fplgn', treatment: 'wide-tracking-caps', treatmentLabel: 'Wide tracking stamp' },
]

export const WORDMARK_VARIATION_IDS = WORDMARK_VARIATIONS.map((v) => v.id)

const variationById = new Map(WORDMARK_VARIATIONS.map((v) => [v.id, v]))

export function isWordmarkVariationId(id: string): boolean {
  return variationById.has(id)
}

export function getWordmarkVariation(id: string): WordmarkVariationDef | null {
  return variationById.get(id) ?? null
}

export function variationIdForStableIndex(index: number): string {
  const n = WORDMARK_VARIATIONS.length
  return WORDMARK_VARIATIONS[((index % n) + n) % n]!.id
}

export function stableCatalogIndex(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h
}
