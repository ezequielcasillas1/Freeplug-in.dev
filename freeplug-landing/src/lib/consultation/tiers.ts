// Copied from the buyout-tiers-2026-10-19 branch (Cheke's final tiers, Oct 19). When that branch lands, import from @/lib/buyout/tiers instead.
/**
 * Buyout tiers: customers see prices up front and pick by page count.
 * The price covers the website files only. Every dollar already paid counts toward it (ownership.ts).
 * The admin Buyout price (website_requests.buyout_price_cents) stays as an override and wins when set.
 *
 * Ladder (Nov 2026): 1–5 pages at $50/page ($250–$450), 6–7 $700, 8–11 $950, 12–15 $1,200,
 * 16–25 $2,000, 26+ custom quote (no fixed price; admin override sets it).
 */
export const BUYOUT_TIER_PAGE_LIMITS = [1, 2, 3, 4, 5, 7, 11, 15, 25] as const

export const BUYOUT_LAST_FIXED_PAGES = 25
export const WEBSITE_BUILD_MAX_PAGES = 35

const COUNTED_CENTS = [25_000, 30_000, 35_000, 40_000, 45_000, 70_000, 95_000, 120_000, 200_000] as const
export const BUYOUT_UNLIMITED_CENTS = 200_000

export type BuyoutTierId =
  | 'p1'
  | 'p2'
  | 'p3'
  | 'p4'
  | 'p5'
  | 'up_to_7'
  | 'up_to_11'
  | 'up_to_15'
  | 'up_to_25'
  | 'custom'

export type BuyoutTier = {
  id: BuyoutTierId
  minPages: number | null
  maxPages: number | null
  cents: number | null
  label: string
}

const COUNTED_IDS: BuyoutTierId[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'up_to_7', 'up_to_11', 'up_to_15', 'up_to_25']

function pageLabel(min: number, max: number): string {
  if (min === max) return min === 1 ? '1 page' : `${max} pages`
  return `${min} to ${max} pages`
}

function buildTiers(limits: readonly number[]): BuyoutTier[] {
  const tiers: BuyoutTier[] = limits.map((max, i) => {
    const min = i === 0 ? 1 : limits[i - 1] + 1
    return {
      id: COUNTED_IDS[i],
      minPages: min,
      maxPages: max,
      cents: COUNTED_CENTS[i],
      label: pageLabel(min, max),
    }
  })
  const last = limits[limits.length - 1]
  tiers.push({
    id: 'custom',
    minPages: last + 1,
    maxPages: null,
    cents: null,
    label: `${last + 1}+ pages`,
  })
  return tiers
}

export const BUYOUT_TIERS: readonly BuyoutTier[] = buildTiers(BUYOUT_TIER_PAGE_LIMITS)

export const buyoutTierById = (id: unknown): BuyoutTier | null => BUYOUT_TIERS.find((t) => t.id === id) ?? null

export function buyoutTierForPages(pages: number): BuyoutTier | null {
  if (!Number.isInteger(pages) || pages < 1) return null
  return BUYOUT_TIERS.find((t) => t.minPages != null && pages >= t.minPages && (t.maxPages == null || pages <= t.maxPages)) ?? null
}

export function buyoutPriceCents(tier: BuyoutTier | null, overrideCents: number | null | undefined): number | null {
  if (overrideCents != null && overrideCents > 0) return overrideCents
  return tier ? tier.cents : null
}

export function buyoutDueCents(priceCents: number, paidCents: number): number {
  return Math.max(0, priceCents - Math.max(0, paidCents))
}

export const formatTierPrice = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

export const BUYOUT_TIERS_HEADING = 'Buyout prices'
export const BUYOUT_TIERS_FILES_ONLY = 'The buyout covers your website files only.'
export const BUYOUT_TIER_PICK_LABEL = 'How many pages does your website have?'
export const BUYOUT_CUSTOM_LINE = "26+ pages? We'll quote it for you."
export const BUYOUT_CUSTOM_PRICE = 'Custom quote'
export const BUYOUT_CUSTOM_TERMS = "Every dollar you've paid counts toward your quote, and the 20% own-domain discount applies too."
export const buyoutDueLine = (dueCents: number) => `After what you've already paid, you'd have ${formatTierPrice(dueCents)} left to pay.`

export function buyoutTierSentence(): string {
  const counted = BUYOUT_TIERS.filter((t) => t.cents != null).map((t) => `${t.label} ${formatTierPrice(t.cents as number)}`)
  return `${counted.slice(0, -1).join(', ')}, and ${counted[counted.length - 1]}`
}
