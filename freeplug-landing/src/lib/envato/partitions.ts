/** Category list (card section 1, core HTML + WP paths) and the 6,000-result cap split. */
export const CORE_CATEGORIES = [
  'site-templates/corporate/business',
  'site-templates/retail/health-beauty',
  'site-templates/retail/food',
  'site-templates/entertainment/restaurants-cafes',
  'wordpress/corporate/business',
  'wordpress/retail/health-beauty',
  'wordpress/retail/food',
  'wordpress/entertainment/restaurants-cafes',
  'wordpress/real-estate',
  'wordpress/corporate/directory-listings',
] as const

export const RESULT_CAP = 6000 // page max 60 x page_size 100
export const PAGE_SIZE = 100

/** Whole-dollar price band, inclusive. max null = no upper bound. */
export type Partition = { category: string; priceMin?: number; priceMax?: number | null; total: number }

/** Initial bands Aria measured live (sum exact on corporate/business). */
export const PRICE_BANDS: Array<{ min: number; max: number | null }> = [
  { min: 0, max: 15 },
  { min: 16, max: 20 },
  { min: 21, max: null },
]

export type CountFn = (q: { category: string; priceMin?: number; priceMax?: number | null }) => Promise<number>

/**
 * One count per category; split by price ONLY when the category is over the cap, and keep halving
 * any band still over the cap. An open-ended band is split at min+40 first.
 */
export async function planPartitions(categories: readonly string[], count: CountFn): Promise<Partition[]> {
  const out: Partition[] = []
  for (const category of categories) {
    const total = await count({ category })
    if (total <= RESULT_CAP) {
      out.push({ category, total })
      continue
    }
    const queue = [...PRICE_BANDS]
    while (queue.length) {
      const band = queue.shift()!
      const n = await count({ category, priceMin: band.min, priceMax: band.max })
      if (n <= RESULT_CAP) {
        out.push({ category, priceMin: band.min, priceMax: band.max, total: n })
        continue
      }
      const hi = band.max ?? band.min + 40
      if (hi <= band.min) {
        throw new Error(`Partition ${category} $${band.min} still over ${RESULT_CAP}; needs a date split`)
      }
      const mid = Math.floor((band.min + hi) / 2)
      queue.unshift({ min: band.min, max: mid }, { min: mid + 1, max: band.max })
    }
  }
  return out
}

export function pagesFor(total: number): number {
  return Math.min(Math.ceil(total / PAGE_SIZE), RESULT_CAP / PAGE_SIZE)
}
