/**
 * Buyout tiers (Cheke, Oct 19 2026, 12:22 AM CT): customers see the prices up front and pick by page count.
 * The price covers the website files only. Every dollar already paid counts toward it (ownership.ts).
 * The admin Buyout price (website_requests.buyout_price_cents) stays as an override and wins when set.
 *
 * ONE setting for the boundaries: the top page count of each counted tier. Each tier starts one page
 * after the previous one ends, so there is never a gap (8 to 11 pages sit in the $950 tier).
 * Final tiers (Cheke via Jace, Oct 19 6:08 AM CT): 5 $500, 7 $700, 11 $950, 12-15 $1,200, 16+ = Unlimited $2,000.
 */
export const BUYOUT_TIER_PAGE_LIMITS = [5, 7, 11, 15] as const

/** Prices in cents, in the same order as BUYOUT_TIER_PAGE_LIMITS; above the last limit is Unlimited. */
const COUNTED_CENTS = [50_000, 70_000, 95_000, 120_000] as const
/** The most anyone ever pays. */
export const BUYOUT_UNLIMITED_CENTS = 200_000

export type BuyoutTierId = 'quick' | 'up_to_7' | 'up_to_11' | 'up_to_15' | 'unlimited'
export type BuyoutTier = {
  id: BuyoutTierId
  /** Inclusive page range; maxPages null = no upper limit (Unlimited: last limit + 1 and up). */
  minPages: number | null
  maxPages: number | null
  cents: number
  label: string
}

const COUNTED_IDS: BuyoutTierId[] = ['quick', 'up_to_7', 'up_to_11', 'up_to_15']

function buildTiers(limits: readonly number[]): BuyoutTier[] {
  const tiers: BuyoutTier[] = limits.map((max, i) => ({
    id: COUNTED_IDS[i],
    minPages: i === 0 ? 1 : limits[i - 1] + 1,
    maxPages: max,
    cents: COUNTED_CENTS[i],
    label: i === 0 ? `Quick: up to ${max} pages` : i === limits.length - 1 ? `${limits[i - 1] + 1} to ${max} pages` : `Up to ${max} pages`,
  }))
  const last = limits[limits.length - 1]
  tiers.push({ id: 'unlimited', minPages: last + 1, maxPages: null, cents: BUYOUT_UNLIMITED_CENTS, label: `Unlimited: ${last + 1} or more pages` })
  return tiers
}

export const BUYOUT_TIERS: readonly BuyoutTier[] = buildTiers(BUYOUT_TIER_PAGE_LIMITS)

export const buyoutTierById = (id: unknown): BuyoutTier | null => BUYOUT_TIERS.find((t) => t.id === id) ?? null

/** The tier for a page count (1+); above the last limit it is Unlimited. */
export function buyoutTierForPages(pages: number): BuyoutTier | null {
  if (!Number.isInteger(pages) || pages < 1) return null
  return BUYOUT_TIERS.find((t) => t.minPages != null && pages >= t.minPages && (t.maxPages == null || pages <= t.maxPages)) ?? null
}

/** The price that applies: the admin override when set, else the picked tier's price. */
export function buyoutPriceCents(tier: BuyoutTier | null, overrideCents: number | null | undefined): number | null {
  if (overrideCents != null && overrideCents > 0) return overrideCents
  return tier ? tier.cents : null
}

/** Every dollar paid counts toward the buyout: what's left to pay (never below $0). */
export function buyoutDueCents(priceCents: number, paidCents: number): number {
  return Math.max(0, priceCents - Math.max(0, paidCents))
}

export const formatTierPrice = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

/** Copy (box draft, Oct 19; Sable to review). */
export const BUYOUT_TIERS_HEADING = 'Buyout prices'
export const BUYOUT_TIERS_FILES_ONLY = 'The buyout covers your website files only.'
export const BUYOUT_TIER_PICK_LABEL = 'How many pages does your website have?'
export const buyoutDueLine = (dueCents: number) => `After what you've already paid, you'd have ${formatTierPrice(dueCents)} left to pay.`

/** "up to 5 pages $500, up to 7 pages $700, up to 11 pages $950, 12 to 15 pages $1,200, and 16 or more pages $2,000" (built from the config). */
export function buyoutTierSentence(): string {
  const last = BUYOUT_TIERS.length - 2
  const counted = BUYOUT_TIERS.map((t, i) => {
    const range = t.maxPages == null ? `${t.minPages} or more pages` : i === last ? `${t.minPages} to ${t.maxPages} pages` : `up to ${t.maxPages} pages`
    return `${range} ${formatTierPrice(t.cents)}`
  })
  return `${counted.slice(0, -1).join(', ')}, and ${counted[counted.length - 1]}`
}
