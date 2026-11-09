import contrastMap from './contrast-map.json'

const lightBlanks = new Set((contrastMap.light_blanks as string[]).map((s) => s.toLowerCase()))
const darkBlanks = new Set((contrastMap.dark_blanks as string[]).map((s) => s.toLowerCase()))

export type BlankKind = 'light' | 'dark'

export function classifyBlankColor(colorName: string | null | undefined): BlankKind {
  if (!colorName) return 'light'
  const c = colorName.toLowerCase()
  for (const d of darkBlanks) {
    if (c.includes(d)) return 'dark'
  }
  for (const l of lightBlanks) {
    if (c.includes(l)) return 'light'
  }
  if (/\b(black|navy|charcoal|maroon|forest|olive|brown)\b/i.test(c)) return 'dark'
  return 'light'
}

export function logoPathForBlank(kind: BlankKind): string {
  return kind === 'dark'
    ? '/merch/shop/freeplug-logo-light-garment.png'
    : '/merch/shop/freeplug-logo-dark-garment.png'
}
