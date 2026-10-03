// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { outreachTracker } from '@/lib/outreach/tracker'
import { accountBillingLine, outreachCancelBox, outreachDashboardState, outreachPlanBox, outreachWebsiteStatus } from './outreach-dashboard'

const loaded = (n: number) => ({ activePlanCount: n, plansLoaded: true })
const failed = { activePlanCount: 0, plansLoaded: false }

describe('outreach dashboard state (Lina, Sep 27; round 9)', () => {
  it('organic customer: unchanged (request card shown, normal subscriptions box, normal Website card)', () => {
    expect(outreachDashboardState(null)).toEqual({ subscriptionState: null, showRequestCard: true, websiteCard: null, activePlansDash: false, accountLine: 'first_payment', showManageBillingAction: true })
    expect(outreachDashboardState(null, { steps: null, plans: loaded(0) }).subscriptionState).toBeNull()
  })

  it('before billing: plan chosen -> plan-waiting; no plan yet -> claim-steps link; never the empty state', () => {
    expect(outreachPlanBox({ plan_hosting_cents: 3500, publish_status: 'none' }, loaded(0))).toBe('plan_waiting')
    expect(outreachPlanBox({ plan_hosting_cents: 3500, publish_status: 'processing' }, failed)).toBe('plan_waiting')
    expect(outreachPlanBox({ plan_hosting_cents: 3500, publish_status: 'failed' }, loaded(1))).toBe('plan_waiting')
    expect(outreachPlanBox({ plan_hosting_cents: null, publish_status: 'none' }, loaded(0))).toBe('choose_plan')
    expect(outreachDashboardState({ plan_hosting_cents: 3500, publish_status: 'none' }).showRequestCard).toBe(false)
  })

  it('live with a real subscription: the real plan', () => {
    expect(outreachPlanBox({ plan_hosting_cents: 3500, publish_status: 'live' }, loaded(1))).toBe('plan')
  })

  it("live but the plan can't be loaded (no subscription, Stripe error, no customer row): Sable's 3:27 line, never plan-waiting", () => {
    expect(outreachPlanBox({ plan_hosting_cents: 3500, publish_status: 'live' }, loaded(0))).toBe('plan_unavailable')
    expect(outreachPlanBox({ plan_hosting_cents: 3500, publish_status: 'live' }, failed)).toBe('plan_unavailable')
    expect(outreachPlanBox({ plan_hosting_cents: null, publish_status: 'live' }, loaded(0))).toBe('plan_unavailable')
  })
})

describe('Website card follows the tracker in every state (round 9)', () => {
  const states = [
    { name: 'claimed only', s: { claimed: true, detailsConfirmed: false, hostingSetUp: false, live: false }, card: 'Your review', tone: 'progress' },
    { name: 'details confirmed', s: { claimed: true, detailsConfirmed: true, hostingSetUp: false, live: false }, card: 'Details confirmed', tone: 'progress' },
    { name: 'card saved (hosting set up)', s: { claimed: true, detailsConfirmed: true, hostingSetUp: true, live: false }, card: 'Hosting set up', tone: 'progress' },
    { name: 'live', s: { claimed: true, detailsConfirmed: true, hostingSetUp: true, live: true }, card: 'Live', tone: 'live' },
    { name: 'live without the earlier flags (published by hand)', s: { claimed: true, detailsConfirmed: false, hostingSetUp: false, live: true }, card: 'Live', tone: 'live' },
  ] as const

  for (const st of states) {
    it(`${st.name}: card reads "${st.card}", matching the tracker`, () => {
      const steps = outreachTracker(st.s)
      const card = outreachWebsiteStatus(steps)
      expect(card).toEqual({ label: st.card, tone: st.tone })
      // Agreement: "Live" exactly when the tracker's Live step is checked; otherwise the card
      // names a checked tracker step, and never "Pending".
      const liveChecked = steps[steps.length - 1].state === 'done'
      expect(card.label === 'Live').toBe(liveChecked)
      expect(steps.some((x) => x.label === card.label && x.state === 'done')).toBe(true)
      expect(card.label).not.toBe('Pending')
      const dash = outreachDashboardState(
        { plan_hosting_cents: 3500, publish_status: st.s.live ? 'live' : 'none' },
        { steps, plans: loaded(0) }
      )
      expect(dash.websiteCard).toEqual(card)
    })
  }
})

// Round 10: Account card line (Sable 3:42 AM) and the "Active Plans" dash (Lina), in every state.
describe('Account card line and Active Plans tile in every state (round 10)', () => {
  const beforeCard = { plan_hosting_cents: 3500, publish_status: 'none', setup_completed_at: null }
  const cardSaved = { plan_hosting_cents: 3500, publish_status: 'none', setup_completed_at: '2026-09-27T08:00:00Z' }
  const live = { plan_hosting_cents: 3500, publish_status: 'live', setup_completed_at: '2026-09-27T08:00:00Z' }
  const state = (site: Parameters<typeof outreachDashboardState>[0], plans: { activePlanCount: number; plansLoaded: boolean }, hasStripeCustomer: boolean) =>
    outreachDashboardState(site, { steps: null, plans, hasStripeCustomer })

  it('outreach before a card: the add-card line, the real count (0) on the tile', () => {
    const s = state(beforeCard, loaded(0), false)
    expect(s.accountLine).toBe('add_card')
    expect(s.activePlansDash).toBe(false)
    expect(accountBillingLine({ plan_hosting_cents: null, publish_status: 'none' }, false)).toBe('add_card')
  })

  it('outreach with a Stripe customer: Manage billing replaces the line (before and after Live)', () => {
    expect(state(beforeCard, loaded(0), true).accountLine).toBe('manage_billing')
    expect(state(cardSaved, loaded(0), true).accountLine).toBe('manage_billing')
    expect(state(live, loaded(1), true).accountLine).toBe('manage_billing')
    expect(state(cardSaved, loaded(0), true).activePlansDash).toBe(false)
  })

  it('outreach card saved, Stripe customer not on the account yet: no line (neither line is true)', () => {
    expect(state(cardSaved, loaded(0), false).accountLine).toBe('none')
  })

  it('outreach live, no Stripe customer (plan cannot load): no line at all, tile shows a dash', () => {
    const s = state(live, loaded(0), false)
    expect(s.subscriptionState).toEqual({ box: 'plan_unavailable' })
    expect(s.accountLine).toBe('none')
    expect(s.activePlansDash).toBe(true)
  })

  it('outreach live, Stripe error: tile shows a dash; the account line follows the Stripe customer', () => {
    const s = state(live, failed, true)
    expect(s.subscriptionState).toEqual({ box: 'plan_unavailable' })
    expect(s.activePlansDash).toBe(true)
    expect(s.accountLine).toBe('manage_billing')
    expect(state(live, failed, false).accountLine).toBe('none')
  })

  it('outreach live with a plan: the real count, Manage billing', () => {
    const s = state(live, loaded(1), true)
    expect(s.subscriptionState).toEqual({ box: 'plan' })
    expect(s.activePlansDash).toBe(false)
    expect(s.accountLine).toBe('manage_billing')
  })

  it('non-outreach: unchanged (first-payment line without a Stripe customer, Manage billing with one, never a dash)', () => {
    expect(state(null, loaded(0), false)).toMatchObject({ accountLine: 'first_payment', activePlansDash: false })
    expect(state(null, failed, false)).toMatchObject({ accountLine: 'first_payment', activePlansDash: false })
    expect(state(null, loaded(2), true)).toMatchObject({ accountLine: 'manage_billing', activePlansDash: false })
  })
})

// Round 11 (Jace / Lina): quick-action "Manage billing" visibility in the seven round 10 states.
describe('quick-action "Manage billing" visibility (round 11)', () => {
  const beforeCard = { plan_hosting_cents: 3500, publish_status: 'none', setup_completed_at: null }
  const cardSaved = { plan_hosting_cents: 3500, publish_status: 'none', setup_completed_at: '2026-09-27T08:00:00Z' }
  const live = { plan_hosting_cents: 3500, publish_status: 'live', setup_completed_at: '2026-09-27T08:00:00Z' }
  const show = (site: Parameters<typeof outreachDashboardState>[0], plans: { activePlanCount: number; plansLoaded: boolean }, hasStripeCustomer: boolean) =>
    outreachDashboardState(site, { steps: null, plans, hasStripeCustomer }).showManageBillingAction

  it.each([
    ['outreach before a card (no Stripe customer)', beforeCard, loaded(0), false, false],
    ['outreach with a Stripe customer (card saved)', cardSaved, loaded(0), true, true],
    ['outreach card saved, Stripe customer not on the account yet', cardSaved, loaded(0), false, false],
    ['outreach live, no Stripe customer', live, loaded(0), false, false],
    ['outreach live, Stripe error with a Stripe customer', live, failed, true, true],
    ['outreach live with a plan', live, loaded(1), true, true],
    ['non-outreach, no Stripe customer', null, loaded(0), false, true],
  ] as const)('%s -> shown: %s', (_name, site, plans, hasCustomer, expected) => {
    expect(show(site, plans, hasCustomer)).toBe(expected)
  })

  it('non-outreach with a Stripe customer (and a Stripe error): still shown', () => {
    expect(show(null, loaded(2), true)).toBe(true)
    expect(show(null, failed, true)).toBe(true)
  })
})

// Round 12: /dashboard/cancel uses the same plan states (outreachCancelBox).
describe('Cancel page plan state for outreach customers (round 12)', () => {
  const pre = { plan_hosting_cents: 3500, publish_status: 'none', setup_completed_at: null }
  const noPlanYet = { plan_hosting_cents: null, publish_status: 'none' }
  const live = { plan_hosting_cents: 3500, publish_status: 'live', setup_completed_at: '2026-09-27T08:00:00Z' }
  const d = (active: number, ended: number, loaded = true) => ({ subscriptions: Array(active).fill(0), canceledSubscriptions: Array(ended).fill(0), subscriptionsLoaded: loaded })
  it('before Live: plan-waiting (or the claim link with no plan yet), whatever Stripe says', () => {
    expect(outreachCancelBox(pre, d(0, 0))).toBe('plan_waiting')
    expect(outreachCancelBox(pre, d(0, 0, false))).toBe('plan_waiting')
    expect(outreachCancelBox(pre, d(1, 0))).toBe('plan_waiting')
    expect(outreachCancelBox(noPlanYet, d(0, 0))).toBe('choose_plan')
  })
  it('after Live: no plan or a Stripe error -> 3:27 line; any subscription (active, ending, canceled) -> the cancel flow', () => {
    expect(outreachCancelBox(live, d(0, 0))).toBe('plan_unavailable')
    expect(outreachCancelBox(live, d(0, 0, false))).toBe('plan_unavailable')
    expect(outreachCancelBox(live, d(1, 0))).toBe('plan')
    expect(outreachCancelBox(live, d(0, 1))).toBe('plan')
  })
})
