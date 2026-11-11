import type { WordmarkTreatment } from './wordmark-variations'

export const WORDMARK_STYLE_GROUPS = [
  'box',
  'outline',
  'stacked',
  'slanted',
  'stamp',
  'script',
  'wide',
  'accent',
] as const

export type WordmarkStyleGroup = (typeof WORDMARK_STYLE_GROUPS)[number]

const GROUP_BY_TREATMENT: Record<WordmarkTreatment, WordmarkStyleGroup> = {
  'red-box-script': 'script',
  'white-invert-box': 'box',
  'outline-hollow-box': 'outline',
  'stacked-two-line': 'stacked',
  'slanted-italic-box': 'slanted',
  'chest-left-mini-box': 'box',
  'wide-stretched': 'wide',
  'stamp-badge': 'stamp',
  'underline-accent': 'accent',
  'charcoal-box-dispatch': 'box',
  'code-mono-panel': 'box',
  'inverted-white-panel': 'box',
  'outline-text-only': 'outline',
  'double-strike': 'accent',
  'red-box-dispatch': 'box',
  'corner-ribbon': 'stamp',
  'wide-tracking-caps': 'wide',
  'script-float': 'script',
  'split-dot-badge': 'stacked',
  'dash-border-stamp': 'stamp',
  'thick-outline-box': 'outline',
  'vertical-stack-tight': 'stacked',
  'mono-brackets': 'accent',
  'accent-bar-left': 'accent',
  'condensed-red-fill': 'box',
  'pill-outline': 'outline',
  'buyer-cursive': 'script',
  'buyer-cursive-plate': 'script',
  'buyer-pop-v2': 'wide',
  'buyer-pop-plate-v2': 'box',
}

export function styleGroupForTreatment(treatment: WordmarkTreatment): WordmarkStyleGroup {
  return GROUP_BY_TREATMENT[treatment]
}

export function isWordmarkStyleGroup(v: string): v is WordmarkStyleGroup {
  return (WORDMARK_STYLE_GROUPS as readonly string[]).includes(v)
}
