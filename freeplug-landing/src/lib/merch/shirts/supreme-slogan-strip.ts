import type { ShirtColor } from '@/lib/merch/shirts/catalog'
import { classifyBlankColor } from '@/lib/merch/shop/contrast'
import type { SupremePreviewSpec } from '@/lib/merch/shirts/supreme-preview'
import { MOCKUP_NORMALIZED_SIZE } from '@/lib/merch/preview/preview-overlay-layout'

export type SupremeSloganStripLayout = {
  centerX: number
  centerY: number
  /** Max print width in viewBox units (0–100). */
  printMaxW: number
  stripW: number
  stripH: number
  padX: number
  padY: number
  fontSize: number
  lineStep: number
  lines: string[]
  textBlockH: number
  startY: number
  boxed: boolean
  boxBg: string
  textColor: string
}

const FONT_STACK =
  "'Freeplug Dispatch Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"

export { FONT_STACK }

function sloganFontSize(lines: string[], boxW: number): number {
  const longest = Math.max(...lines.map((line) => line.length))
  const base =
    lines.length >= 3 ? 5.2 : lines.length === 2 ? 6 : longest > 20 ? 4.6 : longest > 14 ? 5.4 : 7
  return Math.min(base, (boxW * 0.92) / (longest * 0.62))
}

export function supremeSloganStripLayout(spec: SupremePreviewSpec, shirtColor: ShirtColor): SupremeSloganStripLayout {
  const { placement, lines } = spec
  const printMaxW = placement.width * MOCKUP_NORMALIZED_SIZE
  const centerX = (placement.left + placement.width / 2) * MOCKUP_NORMALIZED_SIZE
  /** Spec `top` was authored for the old tall baked chest band — nudge live strip down so it clears artwork. */
  const legacyBandBias =
    spec.style === 'boxed' ? 0.02 + Math.max(0, lines.length - 1) * 0.003 : 0.01
  const centerY = (placement.top + legacyBandBias) * MOCKUP_NORMALIZED_SIZE
  const fontSize = sloganFontSize(lines, printMaxW)
  const lineStep = fontSize * placement.lineHeight
  const textBlockH = lines.length * lineStep
  const lightGarment = shirtColor === 'White' || shirtColor === 'Natural'
  const boxed = !lightGarment && spec.style === 'boxed'
  const padY = boxed ? Math.min(1.2, fontSize * 0.22) : 0
  const padX = boxed ? Math.min(2.2, fontSize * 0.35) : 0
  const longest = Math.max(...lines.map((line) => line.length))
  const textW = longest * fontSize * 0.58 + padX * 2
  const stripW = Math.min(printMaxW, Math.max(textW, fontSize * 2.8))
  const stripH = textBlockH + padY * 2
  const startY = -textBlockH / 2 + fontSize * 0.35

  let boxBg = 'transparent'
  let textColor = '#171717'
  if (!lightGarment) {
    textColor = '#ffffff'
    if (shirtColor === 'Black') {
      boxBg = boxed ? '#1c1c1c' : 'transparent'
    } else if (shirtColor === 'Charcoal') {
      boxBg = boxed ? '#454545' : 'transparent'
    } else {
      boxBg = boxed ? '#3a3a3a' : 'transparent'
    }
  }

  return {
    centerX,
    centerY,
    printMaxW,
    stripW,
    stripH,
    padX,
    padY,
    fontSize,
    lineStep,
    lines,
    textBlockH,
    startY,
    boxed: boxed && boxBg !== 'transparent',
    boxBg,
    textColor,
  }
}

/** Normalized 0–1 print footprint for audits. */
export function supremeSloganNormalizedStrip(spec: SupremePreviewSpec): {
  left: number
  top: number
  width: number
  height: number
} {
  const p = spec.placement
  const centerX = p.left + p.width / 2
  const lineCount = spec.lines.length
  const relH =
    (lineCount >= 3 ? 0.075 : lineCount === 2 ? 0.065 : 0.055) * (spec.style === 'boxed' ? 1.1 : 1)
  const legacyBandBias =
    spec.style === 'boxed' ? 0.02 + Math.max(0, lineCount - 1) * 0.003 : 0.01
  const centerY = p.top + legacyBandBias
  return {
    left: centerX - p.width / 2,
    top: centerY - relH / 2,
    width: p.width,
    height: relH,
  }
}

export function supremeSloganFabricFill(shirtColor: ShirtColor): string {
  const kind = classifyBlankColor(shirtColor)
  return kind === 'light' ? '#f0f0f0' : '#1c1c1c'
}
