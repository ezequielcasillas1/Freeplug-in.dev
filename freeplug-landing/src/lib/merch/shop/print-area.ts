import type { ShopPrintArea } from './types'

/** Printify catalog print areas are pixel dimensions at 300 DPI. */
export const PRINTIFY_PRINT_AREA_DPI = 300

export function printAreaSizeInches(area: ShopPrintArea): { widthIn: number; heightIn: number } {
  return {
    widthIn: area.width / PRINTIFY_PRINT_AREA_DPI,
    heightIn: area.height / PRINTIFY_PRINT_AREA_DPI,
  }
}
