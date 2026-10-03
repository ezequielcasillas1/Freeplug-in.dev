import type { TrackerStep } from '@/lib/outreach/tracker'

/**
 * Dashboard differences for a claimed outreach customer (Lina / Sable 12:38 AM and 3:27 AM,
 * Sep 27). Organic customers (no claimed outreach site) get the dashboard unchanged.
 *   * Subscriptions box: an outreach customer never sees "No active subscriptions / View
 *     available plans". Before Live: a link back to the claim steps (no plan chosen yet) or the
 *     plan-waiting message. After Live: their real plan, or, when it can't be loaded (no
 *     subscription found, a Stripe error, no Stripe customer on the account), Sable's 3:27 line.
 *   * The "Website" stat card reads from the same tracker steps as "Your website", so it can
 *     never say "Pending" while the tracker shows Live.
 *   * The "Your request" card (organic request form status) is hidden.
 *   * "Active Plans" tile (Lina, round 10): after Live when the plan can't be loaded it shows a
 *     dash like "Customer Since", not 0 (a 0 contradicts "Your site is live").
 *   * Account card billing line (Sable 3:42 AM): see accountBillingLine().
 *   * Quick-action "Manage billing" (Jace / Lina, round 11): hidden for an outreach customer
 *     without a Stripe customer (no card yet, or Live with no Stripe customer). Shown whenever the
 *     account has a Stripe customer (a Stripe error included) and always for regular customers.
 */
export type OutreachDashboardSite = {
  /** Hosting-ladder step chosen at claim step 3. A pre-ladder choice alone means "choose again". */
  plan_step: string | null
  publish_status: string
  /** Card saved (setup-mode Checkout completed). */
  setup_completed_at?: string | null
} | null

export type OutreachPlanBox = 'choose_plan' | 'plan_waiting' | 'plan' | 'plan_unavailable'
export type OutreachSubscriptionState = { box: OutreachPlanBox } | null
export type WebsiteCardStatus = { label: string; tone: 'live' | 'progress' }
/**
 * What the Account card shows under the email:
 *   manage_billing: the Manage billing button (the account has a Stripe customer), everyone
 *   first_payment:  "After your first payment, ..." (regular customers, unchanged)
 *   add_card:       "After you add your card, ..." (outreach, card not added yet)
 *   none:           nothing, the card is just the email (outreach after Live with no Stripe
 *                   customer; also outreach with the card saved but the account's Stripe customer
 *                   not written yet, where neither line is true)
 */
export type AccountBillingLine = 'manage_billing' | 'first_payment' | 'add_card' | 'none'

export type OutreachPlanData = {
  /** Active or trialing subscriptions loaded for the account. */
  activePlanCount: number
  /** False when the Stripe lookup failed (the count is then meaningless). */
  plansLoaded: boolean
}

export function outreachPlanBox(site: NonNullable<OutreachDashboardSite>, plans: OutreachPlanData): OutreachPlanBox {
  if (site.publish_status === 'live') {
    return plans.plansLoaded && plans.activePlanCount > 0 ? 'plan' : 'plan_unavailable'
  }
  return site.plan_step != null ? 'plan_waiting' : 'choose_plan'
}

/**
 * /dashboard/cancel for an outreach customer (round 12): the same plan states as the dashboard.
 * Any subscription Stripe returned (active, set to end, or canceled) counts as "a real plan" here,
 * so the existing cancel / resume / restart flow keeps working for a live outreach customer who
 * already canceled. 'plan' = show the existing cancel flow; anything else = OutreachPlanCard.
 */
export function outreachCancelBox(
  site: NonNullable<OutreachDashboardSite>,
  data: { subscriptions: readonly unknown[]; canceledSubscriptions: readonly unknown[]; subscriptionsLoaded: boolean }
): OutreachPlanBox {
  return outreachPlanBox(site, {
    activePlanCount: data.subscriptions.length + data.canceledSubscriptions.length,
    plansLoaded: data.subscriptionsLoaded,
  })
}

/**
 * The Website card for an outreach customer, from the tracker steps: "Live" once Live is checked,
 * otherwise the last checked step (Built, Your review, Details confirmed, Hosting set up).
 */
export function outreachWebsiteStatus(steps: readonly TrackerStep[]): WebsiteCardStatus {
  const last = steps[steps.length - 1]
  if (last && last.state === 'done') return { label: last.label, tone: 'live' }
  const done = steps.filter((s) => s.state === 'done')
  return { label: done.length ? done[done.length - 1].label : (steps[0]?.label ?? ''), tone: 'progress' }
}

export function accountBillingLine(site: OutreachDashboardSite, hasStripeCustomer: boolean): AccountBillingLine {
  if (hasStripeCustomer) return 'manage_billing'
  if (!site) return 'first_payment'
  if (site.publish_status === 'live') return 'none'
  return site.setup_completed_at ? 'none' : 'add_card'
}

export function outreachDashboardState(
  site: OutreachDashboardSite,
  opts: { steps: readonly TrackerStep[] | null; plans: OutreachPlanData; hasStripeCustomer?: boolean } = {
    steps: null,
    plans: { activePlanCount: 0, plansLoaded: true },
  }
): {
  subscriptionState: OutreachSubscriptionState
  showRequestCard: boolean
  websiteCard: WebsiteCardStatus | null
  /** True: the "Active Plans" tile shows a dash instead of the count. */
  activePlansDash: boolean
  accountLine: AccountBillingLine
  /** False: the quick-action row drops "Manage billing" (three buttons). */
  showManageBillingAction: boolean
} {
  const hasStripeCustomer = opts.hasStripeCustomer === true
  const accountLine = accountBillingLine(site, hasStripeCustomer)
  if (!site) {
    return { subscriptionState: null, showRequestCard: true, websiteCard: null, activePlansDash: false, accountLine, showManageBillingAction: true }
  }
  const box = outreachPlanBox(site, opts.plans)
  return {
    subscriptionState: { box },
    showRequestCard: false,
    websiteCard: opts.steps ? outreachWebsiteStatus(opts.steps) : null,
    activePlansDash: box === 'plan_unavailable',
    accountLine,
    showManageBillingAction: hasStripeCustomer,
  }
}
