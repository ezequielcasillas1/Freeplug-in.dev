import type { SupremePreviewSpec } from '@/lib/merch/shirts/supreme-preview'
import type { PreviewPlacement } from './placement-defaults'

/** Wordmark art is authored in ~48×16 user units (see WordmarkTreatmentArt Cover widths). */
export const WORDMARK_ART_REFERENCE_WIDTH = 48
export const MOCKUP_NORMALIZED_SIZE = 100

export type BakedPrintMask = {
  top: number
  left: number
  width: number
  height: number
  fill: string
}

export function wordmarkScaleFromPlacement(placement: Pick<PreviewPlacement, 'width' | 'scale'>): number {
  if (placement.scale != null && placement.scale > 0) return placement.scale
  return (placement.width * MOCKUP_NORMALIZED_SIZE) / WORDMARK_ART_REFERENCE_WIDTH
}

export function placementToSvgPoint(placement: Pick<PreviewPlacement, 'top' | 'left'>): { cx: number; cy: number } {
  return {
    cx: placement.left * MOCKUP_NORMALIZED_SIZE,
    cy: placement.top * MOCKUP_NORMALIZED_SIZE,
  }
}

export function shirtFabricMaskFill(blank: 'light' | 'dark'): string {
  return blank === 'light' ? '#ececec' : '#1c1c1c'
}

/** Covers the Printify baked chest box so the live overlay can replace it cleanly. */
export function supremeBakedPrintMask(
  spec: SupremePreviewSpec,
  blank: 'light' | 'dark'
): BakedPrintMask {
  const p = spec.placement
  const lineCount = spec.lines?.length ?? 1
  const relH =
    (lineCount >= 3 ? 0.075 : lineCount === 2 ? 0.065 : 0.055) * (spec.style === 'boxed' ? 1.1 : 1)
  return {
    top: p.top,
    left: p.left + p.width / 2,
    width: p.width,
    height: relH,
    fill: shirtFabricMaskFill(blank),
  }
}

export function wordmarkUsesCompactLayout(placementWidth: number, labelLength: number): boolean {
  return placementWidth < 0.31 || labelLength > 14
}
