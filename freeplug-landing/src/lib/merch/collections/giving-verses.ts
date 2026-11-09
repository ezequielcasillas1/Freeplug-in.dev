import raw from './giving-verses-catalog.json'

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

export function givingVerseMockupPublicPath(verseId: string): string {
  return `/merch/apparel/giving-verses/${verseId}-mockup.webp`
}

export const GIVING_VERSES_PRODUCT_SLUG = 'giving-verses-tee' as const
export const GOOD_MEASURE_LEGACY_SLUG = 'good-measure-longsleeve' as const
