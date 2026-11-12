import raw from './giving-verses-catalog.json'
import { classifyBlankColor, type BlankKind } from '@/lib/merch/shop/contrast'

export type GivingVerseEntry = {
  id: string
  number: number
  book: string
  ref: string
  phrase: string
  phrase_note: string | null
}

const data = raw as { verses: GivingVerseEntry[] }

export function listGivingVerses(): GivingVerseEntry[] {
  return data.verses
}

export function getGivingVerse(id: string): GivingVerseEntry | null {
  return data.verses.find((v) => v.id === id) ?? null
}

export function givingVersePreviewPath(verseId: string, blankKind: BlankKind): string {
  const suffix = blankKind === 'dark' ? 'on-dark' : 'on-light'
  return `/merch/apparel/giving-verses/${verseId}-${suffix}.webp`
}

export function givingVersePreviewForColor(verseId: string, colorName: string): string {
  return givingVersePreviewPath(verseId, classifyBlankColor(colorName))
}

/** @deprecated use givingVersePreviewPath */
export function givingVerseMockupPublicPath(verseId: string): string {
  return givingVersePreviewPath(verseId, 'light')
}

export const GIVING_VERSES_PRODUCT_SLUG = 'giving-verses-tee' as const
export const GOOD_MEASURE_LEGACY_SLUG = 'good-measure-longsleeve' as const
