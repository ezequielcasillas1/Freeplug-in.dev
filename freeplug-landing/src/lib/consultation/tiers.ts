// Copied from the buyout-tiers-2026-10-19 branch (Cheke's final tiers, Oct 19). When that branch lands, import from @/lib/buyout/tiers instead.
/**
 * Buyout tiers (Cheke, Oct 19 2026, 12:22 AM CT): customers see the prices up front and pick by page count.
 * The price covers the website files only. Every dollar already paid counts toward it (ownership.ts).
 * The admin Buyout price (website_requests.buyout_price_cents) stays as an override and wins when set.
 *
 * ONE setting for the boundaries: the top page count of each counted tier. Each tier starts one page
 * after the previous one ends, so there is never a gap (8 to 11 pages sit in the $950 tier).
 * Final tiers (Cheke via Jace, Oct 19 6:08 AM CT): 5 $500, 7 $700, 11 $950, 12-15 $1,200, 16+ = Unlimited $2,000.
 * Oct 30 (Cheke): 5 $500, 6-7 $700, 8-11 $950, 12-15 $1,200, 16-25 $2,000, 26+ = Custom enterprise (no fixed price,
 * scoped by hand; cents null, the admin Buyout price override sets it).
 */
export const BUYOUT_TIER_PAGE_LIMITS = [5, 7, 11, 15, 25] as const

/** Prices in cents, in the same order as BUYOUT_TIER_PAGE_LIMITS; above the last limit is Custom enterprise. */
const COUNTED_CENTS = [50_000, 70_000, 95_000, 120_000, 200_000] as const
/** The highest fixed tier price (16-25 pages). Still the admin override cap (buyout.ts). */
export const BUYOUT_UNLIMITED_CENTS = 200_000

export type BuyoutTierId = 'quick' | 'up_to_7' | 'up_to_11' | 'up_to_15' | 'up_to_25' | 'custom'
export type BuyoutTier = {
  id: BuyoutTierId
  /** Inclusive page range; maxPages null = no upper limit (Custom enterprise: last limit + 1 and up). */
  minPages: number | null
  maxPages: number | null
  /** null = no fixed price (Custom enterprise, quoted by hand). */
  cents: number | null
  label: string
}

const COUNTED_IDS: BuyoutTierId[] = ['quick', 'up_to_7', 'up_to_11', 'up_to_15', 'up_to_25']

function buildTiers(limits: readonly number[]): BuyoutTier[] {
  const tiers: BuyoutTier[] = limits.map((max, i) => ({
    id: COUNTED_IDS[i],
    minPages: i === 0 ? 1 : limits[i - 1] + 1,
    maxPages: max,
    cents: COUNTED_CENTS[i],
    label: i === 0 ? `Up to ${max} pages` : `${limits[i - 1] + 1} to ${max} pages`,
  }))
  const last = limits[limits.length - 1]
  tiers.push({ id: 'custom', minPages: last + 1, maxPages: null, cents: null, label: `Custom enterprise: ${last + 1} or more pages` })
  return tiers
}

export const BUYOUT_TIERS: readonly BuyoutTier[] = buildTiers(BUYOUT_TIER_PAGE_LIMITS)

export const buyoutTierById = (id: unknown): BuyoutTier | null => BUYOUT_TIERS.find((t) => t.id === id) ?? null

/** The tier for a page count (1+); above the last limit it is Custom enterprise. */
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
/** Oct 30: shown with the tiers instead of a price for 26+ pages. */
export const BUYOUT_CUSTOM_LINE = "26 or more pages? We'll quote it for you."
export const BUYOUT_CUSTOM_PRICE = 'Custom quote'
/** Oct 30 11:05 (Cheke): payments credit and the 20% own-domain discount apply to Custom enterprise quotes too. Box draft for Sable. */
export const BUYOUT_CUSTOM_TERMS = "Every dollar you've paid counts toward your quote, and the 20% own-domain discount applies too."
export const buyoutDueLine = (dueCents: number) => `After what you've already paid, you'd have ${formatTierPrice(dueCents)} left to pay.`

/** "up to 5 pages $500, 6 to 7 pages $700, 8 to 11 pages $950, 12 to 15 pages $1,200, and 16 to 25 pages $2,000" (fixed-price tiers only, built from the config). */
export function buyoutTierSentence(): string {
  const counted = BUYOUT_TIERS.filter((t) => t.cents != null).map((t, i) => {
    const range = i === 0 ? `up to ${t.maxPages} pages` : `${t.minPages} to ${t.maxPages} pages`
    return `${range} ${formatTierPrice(t.cents as number)}`
  })
  return `${counted.slice(0, -1).join(', ')}, and ${counted[counted.length - 1]}`
}
