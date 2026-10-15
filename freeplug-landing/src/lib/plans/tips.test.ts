import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PLAN_STEPS, TIP_LOOKUP_KEY, TIP_NUDGE_WINDOW_DOLLARS, TIP_TOTAL_RANGES, stepById, type PlanStepId } from './ladder'
import { invoiceTipCents, isTipPrice, parseTipDollars, tierItems, tipDollarsOfItems, tipItemOf, tipLineItems, tipNudge, tipRangeFor } from './tips'
import * as copy from './ladder-copy'
import { planStripLine } from '@/lib/stripe/plan-line'
import { adminPlanAmount } from './admin-badge'

describe('tip ranges (ladder.ts, per step, overridable)', () => {
  it('the configured monthly totals', () => {
    expect(TIP_TOTAL_RANGES).toEqual({
      starter: { minDollars: 35, maxDollars: 54 },
      priority: { minDollars: 55, maxDollars: 64 },
      fast_lane: { minDollars: 65, maxDollars: 74 },
      leads: { minDollars: 75, maxDollars: 84 },
      get_found: { minDollars: 85, maxDollars: 99 },
      growth: { minDollars: 100, maxDollars: 120 },
    })
    for (const s of PLAN_STEPS) expect(TIP_TOTAL_RANGES[s.id].minDollars).toBe(s.monthlyCents / 100) // min = the step price (no tip)
  })

  it.each(PLAN_STEPS.filter((s) => s.sellable).map((s) => [s.id] as const))('%s: slider from the step price (tip 0) to the range max', (id) => {
    const s = stepById(id)
    const r = tipRangeFor(s)!
    expect(r).toEqual({ minTip: 0, maxTip: TIP_TOTAL_RANGES[id].maxDollars - s.monthlyCents / 100, minTotal: s.monthlyCents / 100, maxTotal: TIP_TOTAL_RANGES[id].maxDollars })
  })

  it('no slider for a step that is not sold', () => {
    for (const s of PLAN_STEPS.filter((x) => !x.sellable)) expect(tipRangeFor(s)).toBeNull()
  })

  it('a range override is honoured', () => {
    const ranges = { ...TIP_TOTAL_RANGES, starter: { minDollars: 35, maxDollars: 40 } }
    expect(tipRangeFor(stepById('starter'), ranges)?.maxTip).toBe(5)
    expect(parseTipDollars(stepById('starter'), 6, ranges)).toEqual({ ok: false, code: 'out_of_range' })
  })
})

describe('server-side tip check (checkout, claim, tip change)', () => {
  const bounds: [PlanStepId, number][] = [['starter', 19], ['priority', 9], ['fast_lane', 9]]
  it.each(bounds)('%s accepts 0..%i and refuses one more', (id, max) => {
    const s = stepById(id)
    expect(parseTipDollars(s, 0)).toEqual({ ok: true, tipDollars: 0 })
    expect(parseTipDollars(s, max)).toEqual({ ok: true, tipDollars: max })
    expect(parseTipDollars(s, max + 1)).toEqual({ ok: false, code: 'out_of_range' })
    expect(parseTipDollars(s, -1)).toEqual({ ok: false, code: 'out_of_range' })
  })
  it('missing = no tip; junk is refused', () => {
    const s = stepById('starter')
    expect(parseTipDollars(s, undefined)).toEqual({ ok: true, tipDollars: 0 })
    expect(parseTipDollars(s, null)).toEqual({ ok: true, tipDollars: 0 })
    for (const junk of ['5', 2.5, Number.NaN, Infinity, {}, true]) expect(parseTipDollars(s, junk)).toEqual({ ok: false, code: 'invalid' })
  })
  it('a step that is not sold accepts only 0', () => {
    expect(parseTipDollars(stepById('leads'), 0)).toEqual({ ok: true, tipDollars: 0 })
    expect(parseTipDollars(stepById('leads'), 1)).toEqual({ ok: false, code: 'not_sellable' })
  })
  it('line items: tip price x quantity, nothing for $0 (no price_data anywhere)', () => {
    expect(tipLineItems('price_tip', 5)).toEqual([{ price: 'price_tip', quantity: 5 }])
    expect(tipLineItems('price_tip', 0)).toEqual([])
    expect(tipLineItems(null, 5)).toEqual([])
    const src = readFileSync(path.join(__dirname, 'tips.ts'), 'utf8') + readFileSync(path.join(__dirname, '../../app/api/checkout/hosting/route.ts'), 'utf8')
    expect(src).not.toMatch(/price_data/)
  })
})

describe('tip item helpers (tier lookup with a tip item)', () => {
  const tier = { id: 'si_1', price: { lookup_key: 'freeplug_step_starter_monthly', product: 'freeplug_step_starter' }, quantity: 1 }
  const tip = { id: 'si_t', price: { lookup_key: TIP_LOOKUP_KEY, product: 'freeplug_tip' }, quantity: 6 }
  const tipByProduct = { id: 'si_p', price: { lookup_key: null, product: { id: 'freeplug_tip' } }, quantity: 3 }
  it('splits tier and tip items', () => {
    expect(tierItems([tip, tier])).toEqual([tier])
    expect(tipItemOf([tip, tier])).toBe(tip)
    expect(tipDollarsOfItems([tier])).toBe(0)
    expect(tipDollarsOfItems([tier, tip])).toBe(6)
    expect(isTipPrice(tipByProduct.price)).toBe(true)
    expect(isTipPrice(tier.price)).toBe(false)
  })
  it('invoice tip cents (ledger): tip lines by product, credits count, never below 0', () => {
    const inv = (lines: unknown[]) => ({ lines: { data: lines } }) as Parameters<typeof invoiceTipCents>[0]
    expect(invoiceTipCents(inv([{ amount: 3500, pricing: { price_details: { product: 'freeplug_step_starter' } } }, { amount: 1900, pricing: { price_details: { product: 'freeplug_tip' } } }]))).toBe(1900)
    expect(invoiceTipCents(inv([{ amount: 500, price: { lookup_key: TIP_LOOKUP_KEY } }]))).toBe(500)
    expect(invoiceTipCents(inv([{ amount: -300, pricing: { price_details: { product: 'freeplug_tip' } } }]))).toBe(0)
    expect(invoiceTipCents({})).toBe(0)
  })
})

describe('nudge: within $5 of the next sellable step (Aria, round 5b)', () => {
  it('one ladder.ts constant: TIP_NUDGE_WINDOW_DOLLARS = 5', () => {
    expect(TIP_NUDGE_WINDOW_DOLLARS).toBe(5)
  })
  it('Starter: $50-54 suggests Priority (its main perk); $49 does not; $0 tip never', () => {
    expect(tipNudge(stepById('starter'), 15)).toEqual({ next: stepById('priority'), perk: 'priorityQueue' })
    expect(tipNudge(stepById('starter'), 19)?.next.id).toBe('priority')
    expect(tipNudge(stepById('starter'), 14)).toBeNull()
    expect(tipNudge(stepById('starter'), 10)).toBeNull()
    expect(tipNudge(stepById('starter'), 0)).toBeNull()
  })
  it('Priority: $60-64 suggests Fast lane (its first perk, the included small edit); $59 does not', () => {
    expect(tipNudge(stepById('priority'), 5)).toEqual({ next: stepById('fast_lane'), perk: 'includedSmallEdit' })
    expect(tipNudge(stepById('priority'), 9)?.next.id).toBe('fast_lane')
    expect(tipNudge(stepById('priority'), 4)).toBeNull()
    expect(tipNudge(stepById('priority'), 1)).toBeNull()
  })
  it('the window for every step with a next step (if that step were sold): Fast lane 70-74, Leads 80-84, Get found 95-99', () => {
    const windowOf = (id: PlanStepId) => {
      const s = stepById(id)
      const r = TIP_TOTAL_RANGES[id]
      const hits: number[] = []
      for (let total = r.minDollars; total <= r.maxDollars; total++) {
        const gap = total - s.monthlyCents / 100
        const next = PLAN_STEPS.find((x) => x.rank === s.rank + 1)
        if (!next) continue
        if (next.monthlyCents / 100 - total <= TIP_NUDGE_WINDOW_DOLLARS && gap > 0) hits.push(total)
      }
      return hits.length ? [hits[0], hits[hits.length - 1]] : null
    }
    expect(windowOf('starter')).toEqual([50, 54])
    expect(windowOf('priority')).toEqual([60, 64])
    expect(windowOf('fast_lane')).toEqual([70, 74])
    expect(windowOf('leads')).toEqual([80, 84])
    expect(windowOf('get_found')).toEqual([95, 99])
    expect(windowOf('growth')).toBeNull()
  })
  it('no nudge toward a step that is not sold, and none from the top step', () => {
    expect(stepById('leads').sellable).toBe(false)
    expect(tipNudge(stepById('fast_lane'), 9)).toBeNull()
    expect(tipNudge(stepById('fast_lane'), 5)).toBeNull()
    expect(tipNudge(stepById('growth'), 20)).toBeNull()
  })
  it('the nudge sentence names the next step, its price and perk', () => {
    expect(copy.TIP_NUDGE('Priority', '$55', copy.TIP_NUDGE_PERK.priorityQueue)).toBe(
      'Priority is $55 a month and adds a place ahead of lower plans when you ask for changes. Want that instead? Keeping your tip is fine too.'
    )
  })
})

describe('tip copy and display', () => {
  it('never says "donation" (the feature is the tipping system)', () => {
    const all = Object.values(copy)
      .flatMap((v) => (typeof v === 'string' ? [v] : typeof v === 'function' ? [String((v as (...a: string[]) => string)('$5', '$5', '$5', '$5'))] : typeof v === 'object' && v ? Object.values(v).map(String) : []))
      .join('\n')
    expect(all).not.toMatch(/donat/i)
    expect(copy.TIP_SLIDER_HELP).toContain('optional extra to support Freeplug')
  })
  it("Sable's final confirm lines, word for word", () => {
    expect(copy.UPGRADE_CONFIRM_ZERO('Fast lane', '$65', 'November 3, 2026')).toBe('Switch to Fast lane now? Nothing is charged today. Then $65/month starting November 3, 2026.')
    expect(copy.UPGRADE_REPLACES_PENDING('Starter')).toBe('This replaces your planned switch to Starter.')
    expect(copy.PLAN_CHANGE_TIP_ENDS('$5')).toBe('Your $5 monthly tip ends with this switch.')
    expect(copy.PLAN_CHANGE_TIP_ENDS_ON('$5', 'November 3, 2026')).toBe('Your $5 monthly tip ends on November 3, 2026, when this switch starts.')
  })
  it('the plan strip shows the tip as its own part; admin row "<Tier> $65/mo + $5 tip"', () => {
    const item = { lookupKey: 'freeplug_step_fast_lane_monthly', productName: 'Freeplug Hosting: Fast lane', unitAmountCents: 6500, quantity: 1 }
    expect(planStripLine([item], 'month', 'active', 5)).toBe('Fast lane · $65/month + $5 tip')
    expect(planStripLine([item], 'month', 'active')).toBe('Fast lane · $65/month')
    expect(adminPlanAmount(6500, 500)).toBe('$65/mo + $5 tip')
    expect(adminPlanAmount(6500, 0)).toBe('$65/mo')
  })
})

describe('migration 20261003200000_tipping (static; the live check ran against local Supabase)', () => {
  const sql = readFileSync(path.join(__dirname, '../../../supabase/migrations/20261003200000_tipping.sql'), 'utf8')
  it('adds the three columns with their range checks', () => {
    expect(sql).toMatch(/alter table public\.outreach_sites[\s\S]*add column if not exists plan_tip_dollars integer/)
    expect(sql).toMatch(/plan_tip_dollars is null or plan_tip_dollars between 0 and 500/)
    expect(sql).toMatch(/add column if not exists tip_cents integer not null default 0/)
    expect(sql).toMatch(/tip_cents >= 0 and tip_cents <= greatest\(amount_cents, 0\)/)
    expect(sql).toMatch(/add column if not exists plan_tip_cents integer/)
  })
  it('the profiles guard trigger covers plan_tip_cents on insert and update (customers cannot set it)', () => {
    expect(sql).toMatch(/new\.plan_tip_cents is null then/)
    expect(sql).toMatch(/new\.plan_tip_cents is not distinct from old\.plan_tip_cents then/)
  })
})

describe('"Total Paid" counter counts everything paid, tips included (Aria, Oct 3 3:31 PM CT)', () => {
  const read = (rel: string) => readFileSync(path.join(__dirname, '../../', rel), 'utf8')
  it('the webhook adds the full amount paid (no tip carve-out, no flag)', () => {
    const route = read('app/api/webhooks/stripe/route.ts')
    // Phase 4 L-2: the increment is record_invoice_paid's (one transaction), with the full amount paid.
    expect(route).toMatch(/rpc\('record_invoice_paid'[\s\S]*?p_amount_cents: inv\.amount_paid,/)
    const fn = readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261013093000_record_invoice_paid.sql'), 'utf8')
    expect(fn).toMatch(/cumulative_website_value_paid_cents = coalesce\(cumulative_website_value_paid_cents, 0\) \+ p_amount_cents/)
    expect(route).not.toMatch(/buyoutValueCents|BUYOUT_COUNTS_TIPS/)
    expect(read('lib/plans/ladder.ts')).not.toMatch(/BUYOUT_COUNTS_TIPS/)
  })
  it('the admin "Paid (cumulative)" column and the customer "Total Paid" read the same column the webhook writes', () => {
    expect(read('app/admin/AdminCustomersTable.tsx')).toMatch(/r\.cumulative_website_value_paid_cents/)
    expect(read('app/(dashboard)/dashboard/dashboard-actions.ts')).toMatch(/totalPaidCents: profile\?\.cumulative_website_value_paid_cents/)
  })
})
