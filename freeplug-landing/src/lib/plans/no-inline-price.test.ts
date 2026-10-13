import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Hosting ladder guard: new hosting plans are charged ONLY through lookup-key prices
// (src/lib/stripe/prices.ts). The retired slider and add-ons must not come back as inline prices.
// One-time maintenance checkout keeps its own price_data and is not covered here.
const SRC = join(__dirname, '..', '..')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

describe('no inline prices for hosting plans', () => {
  it.each(['app/api/checkout/hosting/route.ts', 'lib/outreach/billing.ts'])('%s builds no price_data and no add-on item', (rel) => {
    const s = read(rel)
    expect(s).not.toMatch(/price_data/)
    expect(s).not.toMatch(/addonProductId|ensureProduct|unit_amount/)
    // The retired field names may appear only inside the 400 refusal check.
    const uses = s.split('\n').filter((l) => /hostingMonthlyCents|addonTier/.test(l))
    for (const l of uses) expect(l).toMatch(/' in body/)
    expect(s).toMatch(/getStepPriceId|stepPriceId/)
  })

  it('the old slider is gone from the hosting card, schemas and checkout', () => {
    for (const rel of ['components/plans/HostingCheckoutCard.tsx', 'lib/outreach/schemas.ts', 'app/api/checkout/hosting/route.ts']) {
      const s = read(rel)
      expect(s, rel).not.toMatch(/type="range"|hostingMonthlyCents:|HOSTING_MIN_CENTS|addonTier:|ADDON_TIERS/)
    }
  })
})
