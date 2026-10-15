import { describe, expect, it } from 'vitest'
import {
  LEGACY_ADDON_TIERS,
  PLAN_STEPS,
  PLAN_STEP_IDS,
  compareQueue,
  cumulativePerks,
  entitlementsFor,
  resolvePlanStep,
  stepByLookupKey,
  stepForMonthlyCents,
} from './ladder'
import { nextBusinessDayDue } from './due-by'
import { adminPlanBadge } from './admin-badge'
import { periodStartDate, recordIncludedEdit, type IncludedEditStore } from './included-edits'
import { PRIORITY_MIN_MONTHLY_CENTS } from './priority'

describe('hosting ladder config (Aria card, Oct 3)', () => {
  it('has the six fixed steps, prices, AI-edit quotas and lookup keys from the card', () => {
    expect(PLAN_STEPS.map((s) => [s.id, s.name, s.monthlyCents, s.aiEditsPerMonth, s.rank])).toEqual([
      ['starter', 'Starter', 3500, 5, 0],
      ['priority', 'Priority', 5500, 15, 1],
      ['fast_lane', 'Fast lane', 6500, 15, 2],
      ['leads', 'Leads', 7500, 40, 3],
      ['get_found', 'Get found', 8500, 40, 4],
      ['growth', 'Growth partner', 10000, 40, 5],
    ])
    for (const s of PLAN_STEPS) expect(s.lookupKey).toBe(`freeplug_step_${s.id}_monthly`)
    // One Stripe product per step (Aria 6.1; the portal can't hold two monthly prices of one product).
    for (const s of PLAN_STEPS) expect(s.productId).toBe(`freeplug_step_${s.id}`)
    expect(new Set(PLAN_STEPS.map((s) => s.lookupKey)).size).toBe(6)
    expect(PLAN_STEP_IDS).toEqual(PLAN_STEPS.map((s) => s.id))
  })

  it('perks are cumulative: each step includes everything below it', () => {
    expect(cumulativePerks('starter')).toEqual([])
    expect(cumulativePerks('priority')).toEqual(['priorityQueue'])
    expect(cumulativePerks('fast_lane')).toEqual(['priorityQueue', 'includedSmallEdit', 'nextBusinessDayEdits'])
    for (let i = 1; i < PLAN_STEPS.length; i++) {
      const lower = cumulativePerks(PLAN_STEPS[i - 1].id)
      const upper = cumulativePerks(PLAN_STEPS[i].id)
      expect(upper.slice(0, lower.length)).toEqual(lower)
    }
    expect(cumulativePerks('growth')).toEqual([
      'priorityQueue',
      'includedSmallEdit',
      'nextBusinessDayEdits',
      'leadsReport',
      'quoteAlerts',
      'gbpManaged',
      'reviewKit',
      'seasonalRefresh',
      'quarterlyCall',
      'doneForYouEdits',
    ])
  })

  it('entitlements per step', () => {
    expect(entitlementsFor({ stepId: 'starter' })).toMatchObject({ priorityRank: 0, includedEditsPerMonth: 0, aiEditsPerMonth: 5, legacy: false })
    expect(entitlementsFor({ stepId: 'priority' })).toMatchObject({ priorityRank: 1, includedEditsPerMonth: 0, nextBusinessDayEdits: false })
    expect(entitlementsFor({ stepId: 'fast_lane' })).toMatchObject({ includedEditsPerMonth: 1, nextBusinessDayEdits: true, leadsReport: false })
    expect(entitlementsFor({ stepId: 'leads' })).toMatchObject({ leadsReport: true, quoteAlerts: true, gbpManaged: false })
    expect(entitlementsFor({ stepId: 'get_found' })).toMatchObject({ gbpManaged: true, reviewKit: true, seasonalRefresh: false })
    expect(entitlementsFor({ stepId: 'growth' })).toMatchObject({ seasonalRefresh: true, quarterlyCall: true, doneForYouEdits: true, monthlyCents: 10000 })
  })

  it('resolves untrusted input to a step or null', () => {
    expect(resolvePlanStep('leads')?.monthlyCents).toBe(7500)
    for (const bad of ['basic', 'plus', 'pro', 'Leads', '', null, undefined, 55, {}]) expect(resolvePlanStep(bad)).toBeNull()
    expect(stepByLookupKey('freeplug_step_growth_monthly')?.id).toBe('growth')
    expect(stepByLookupKey('freeplug_addon_pro_monthly')).toBeNull()
  })

  it.each([
    [3499, null],
    [3500, 'starter'],
    [5499, 'starter'],
    [5500, 'priority'],
    [6499, 'priority'],
    [6500, 'fast_lane'],
    [10000, 'growth'],
    [11500, 'growth'],
  ])('stepForMonthlyCents(%i) = %s', (cents, id) => {
    expect(stepForMonthlyCents(cents)?.id ?? null).toBe(id)
  })

  it('Priority threshold is the Priority step price (one source)', () => {
    expect(PRIORITY_MIN_MONTHLY_CENTS).toBe(5500)
    expect(entitlementsFor({ stepId: 'starter' }).priorityRank).toBe(0)
    expect(entitlementsFor({ stepId: 'priority' }).priorityRank).toBe(1)
  })
})

describe('grandfathered Basic/Plus/Pro add-on subscribers (read, never migrated)', () => {
  it('legacy tiers carry no backups or alerts promise', () => {
    expect(JSON.stringify(LEGACY_ADDON_TIERS)).not.toMatch(/backup|alert|uptime/i)
  })

  it('$35 + Pro: keeps GBP and one included edit, no new-ladder perks, no Priority', () => {
    const e = entitlementsFor({ legacy: { hostingCents: 3500, addonTier: 'pro' } })
    expect(e).toMatchObject({
      legacy: true,
      legacyAddon: 'pro',
      monthlyCents: 5000,
      gbpManaged: true,
      includedEditsPerMonth: 1,
      priorityRank: 0,
      nextBusinessDayEdits: false,
      leadsReport: false,
      reviewKit: false,
      doneForYouEdits: false,
    })
    expect(e.step?.id).toBe('starter')
  })

  it('$40 + Pro = $55: Priority (Sep 25 rule), still legacy', () => {
    const e = entitlementsFor({ legacy: { hostingCents: 4000, addonTier: 'pro' } })
    expect(e).toMatchObject({ legacy: true, monthlyCents: 5500, priorityRank: 1, gbpManaged: true, includedEditsPerMonth: 1 })
  })

  it('Basic: no included edit, no GBP; Plus: one included edit, no GBP; none: hosting only', () => {
    expect(entitlementsFor({ legacy: { hostingCents: 3500, addonTier: 'basic' } })).toMatchObject({ includedEditsPerMonth: 0, gbpManaged: false })
    expect(entitlementsFor({ legacy: { hostingCents: 3500, addonTier: 'plus' } })).toMatchObject({ includedEditsPerMonth: 1, gbpManaged: false })
    expect(entitlementsFor({ legacy: { hostingCents: 8000, addonTier: 'none' } })).toMatchObject({
      includedEditsPerMonth: 0,
      gbpManaged: false,
      priorityRank: 3,
      leadsReport: false,
    })
  })
})

describe('requests queue order and admin badge', () => {
  it('sorts by step (highest first), then oldest first', () => {
    const rows = [
      { id: 'a', priorityRank: 0, created_at: '2026-10-01T10:00:00Z' },
      { id: 'b', priorityRank: 5, created_at: '2026-10-02T10:00:00Z' },
      { id: 'c', priorityRank: 1, created_at: '2026-09-30T10:00:00Z' },
      { id: 'd', priorityRank: 5, created_at: '2026-10-01T09:00:00Z' },
      { id: 'e', priorityRank: -1, created_at: '2026-09-01T10:00:00Z' },
      { id: 'f', priorityRank: 0, created_at: '2026-09-29T10:00:00Z' },
    ]
    expect([...rows].sort(compareQueue).map((r) => r.id)).toEqual(['d', 'b', 'c', 'f', 'a', 'e'])
  })

  it('badge: step name, "(legacy)" for grandfathered plans, none without a plan', () => {
    expect(adminPlanBadge(entitlementsFor({ stepId: 'leads' }))).toEqual({ stepId: 'leads', label: 'Leads', priority: true, rank: 3 })
    expect(adminPlanBadge(entitlementsFor({ stepId: 'starter' }))?.priority).toBe(false)
    expect(adminPlanBadge(entitlementsFor({ legacy: { hostingCents: 4000, addonTier: 'pro' } }))?.label).toBe('Priority (legacy)')
    expect(adminPlanBadge({ step: null, legacy: false, priorityRank: -1 })).toBeNull()
  })
})

describe('next business day due time (5 PM Central, Mon-Fri; holidays: due-by.test.ts)', () => {
  const ct = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).format(d)
  it.each([
    ['2026-10-05T15:00:00Z', 'Tue, 10/6, 17'], // Mon 10 AM CDT
    ['2026-10-09T15:00:00Z', 'Mon, 10/12, 17'], // Fri
    ['2026-10-10T15:00:00Z', 'Mon, 10/12, 17'], // Sat
    ['2026-10-11T15:00:00Z', 'Mon, 10/12, 17'], // Sun
    ['2026-10-06T04:30:00Z', 'Tue, 10/6, 17'], // Mon 11:30 PM CDT -> Tue
    ['2026-10-30T20:00:00Z', 'Mon, 11/2, 17'], // across the DST change (Nov 1)
  ])('%s -> %s CT', (iso, expected) => {
    expect(ct(nextBusinessDayDue(new Date(iso)))).toBe(expected)
  })
  it('5 PM CDT is 22:00Z and 5 PM CST is 23:00Z', () => {
    expect(nextBusinessDayDue(new Date('2026-10-05T15:00:00Z')).toISOString()).toBe('2026-10-06T22:00:00.000Z')
    expect(nextBusinessDayDue(new Date('2026-11-09T15:00:00Z')).toISOString()).toBe('2026-11-10T23:00:00.000Z')
  })
})

describe('included small edit (one per billing period, no rollover)', () => {
  function memStore(): IncludedEditStore & { rows: { user_id: string; period_start: string; request_id: string; slot?: number }[] } {
    const rows: { user_id: string; period_start: string; request_id: string; slot?: number }[] = []
    return {
      rows,
      async insertUse(row) {
        // Mirrors UNIQUE (user_id, period_start, slot) and UNIQUE (request_id) (migration 20261004091000).
        if (rows.some((r) => r.user_id === row.user_id && r.period_start === row.period_start && r.slot === row.slot)) {
          return { code: '23505', message: 'duplicate key value violates unique constraint "included_edit_uses_user_period_slot_key"' }
        }
        if (rows.some((r) => r.request_id === row.request_id)) {
          return { code: '23505', message: 'duplicate key value violates unique constraint "included_edit_uses_request_id_key"' }
        }
        rows.push(row)
        return null
      },
    }
  }
  const period = new Date('2026-10-01T05:00:00Z')

  it('records one use, refuses a second in the same period, allows the next period', async () => {
    const s = memStore()
    expect(await recordIncludedEdit(s, { userId: 'u1', requestId: 'r1', includedEditsPerMonth: 1, periodStart: period })).toEqual({ ok: true, slot: 1 })
    expect(await recordIncludedEdit(s, { userId: 'u1', requestId: 'r2', includedEditsPerMonth: 1, periodStart: period })).toMatchObject({
      ok: false,
      reason: 'already_used',
    })
    expect(
      await recordIncludedEdit(s, { userId: 'u1', requestId: 'r3', includedEditsPerMonth: 1, periodStart: new Date('2026-11-01T05:00:00Z') })
    ).toEqual({ ok: true, slot: 1 })
    expect(s.rows).toHaveLength(2)
  })

  it('refuses when the plan has no included edit, or no period is known (nothing written)', async () => {
    const s = memStore()
    expect(await recordIncludedEdit(s, { userId: 'u1', requestId: 'r1', includedEditsPerMonth: 0, periodStart: period })).toMatchObject({ reason: 'not_included' })
    expect(await recordIncludedEdit(s, { userId: 'u1', requestId: 'r1', includedEditsPerMonth: 1, periodStart: null })).toMatchObject({ reason: 'no_period' })
    expect(s.rows).toEqual([])
  })

  it('period start is the UTC date of current_period_start', () => {
    expect(periodStartDate(new Date('2026-10-03T23:30:00Z'))).toBe('2026-10-03')
    expect(periodStartDate(new Date('nope'))).toBeNull()
    expect(periodStartDate(null)).toBeNull()
  })
})
