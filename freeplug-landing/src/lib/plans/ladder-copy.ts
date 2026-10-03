import { PLAN_STEPS, stepById, type PlanPerk, type PlanStepId } from './ladder'

/** "$35" style, from ladder.ts (never hard-code a price in copy). */
const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
/** "$35, $55, $65, $75, $85 or $100", built from PLAN_STEPS. */
const PRICE_LIST = (() => {
  const all = PLAN_STEPS.map((s) => dollars(s.monthlyCents))
  return `${all.slice(0, -1).join(', ')} or ${all[all.length - 1]}`
})()
const STARTER_PRICE = dollars(stepById('starter').monthlyCents)
const INCLUDED_EDIT_FROM = PLAN_STEPS.find((s) => s.adds.includes('includedSmallEdit'))!

/**
 * Hosting-ladder customer copy. ALL strings here are PLACEHOLDERS drafted from Aria's card
 * (section 7) until Sable Quinn / Wren deliver final [STRICT] wording. Swap strings here only; no
 * other file hard-codes ladder copy. Rules for the final copy: no reply-time promise beyond "end of
 * the next business day" (pending Ezequiel), no ranking or lead guarantees, "call button taps" not
 * "calls", and nothing about backups or downtime alerts until they are built.
 */
export const LADDER_COPY_STATUS = 'PLACEHOLDER: pending Sable/Wren final copy' as const

/** PLACEHOLDER (Sable/Wren): one-line blurb per step. */
export const STEP_BLURBS: Record<PlanStepId, string> = {
  starter: 'Your website, hosted and kept secure.',
  priority: 'Everything in Starter. Your change requests go ahead of lower plans in line.',
  fast_lane: 'Everything in Priority, plus one small edit by us each billing period.',
  leads: 'Everything in Fast lane, plus a monthly report and quote alerts.',
  get_found: 'Everything in Leads, plus Google Business Profile upkeep.',
  growth: 'Everything in Get found, plus a seasonal refresh and a quarterly call.',
}

/** PLACEHOLDER (Sable/Wren): perk lines, shown under the step that adds them. */
export const PERK_LINES: Record<PlanPerk, string> = {
  priorityQueue: "When you ask us for a change, you're ahead of lower plans in line.",
  includedSmallEdit:
    "One small edit by us each billing period, like new hours, a photo swap or a price change. Unused edits don't roll over.",
  nextBusinessDayEdits: 'Small edits are done by the end of the next business day.',
  leadsReport:
    'A monthly email showing how many people visited your site, filled out your form, and tapped your call button.',
  quoteAlerts: 'An email the moment someone asks for a quote.',
  gbpManaged: 'We keep your Google Business Profile up to date (hours, photos) and post to it for you.',
  reviewKit: 'A ready-made message and link you can send your customers to ask for reviews.',
  seasonalRefresh: 'Each season we refresh your site with your new photos and offers.',
  quarterlyCall: 'A 15-minute planning call with us every quarter.',
  doneForYouEdits: 'Tell us what you want changed, and we make it for you.',
}

/** PLACEHOLDER (Sable/Wren): included in every step (Starter). */
export const STARTER_BASE_LINES: readonly string[] = [
  'Hosting and SSL (a secure https connection)',
  'Email support during support hours',
]

/** PLACEHOLDER (Sable/Wren). */
export const LADDER_HEADING = 'Choose your hosting plan'
export const LADDER_SUBHEADING = 'Each plan includes everything in the plans before it. Billed monthly through Stripe.'
export const MOST_POPULAR_LABEL = 'Most popular'
export const EVERYTHING_IN = (name: string) => `Everything in ${name}, plus:`
export const PER_MONTH = '/month'
export const CONTINUE_TO_PAYMENT = 'Continue to payment'
export const LEGACY_PLAN_NOTE =
  'Already have an add-on? You keep it at the same price. You can switch to one of these plans on the Plans page at any time.'
export const LEGACY_PLAN_LABEL = 'Your current plan (no longer sold)'
export const INCLUDED_EDIT_LINE = (used: number, available: number) =>
  used >= available
    ? 'Your included edit: used this billing period.'
    : `Your included edit: ${available - used} available this billing period.`
export const NEXT_BUSINESS_DAY_LINE = 'Small edits: done by the end of the next business day.'
export const AI_EDITS_LINE = (n: number) => `AI edits: ${n} a month (coming soon)`

/** Step marked "Most popular" on the cards; null for none. PLACEHOLDER (Lina/Sable decide). */
export const MOST_POPULAR_STEP: PlanStepId | null = 'fast_lane'

/** PLACEHOLDER (Sable): landing "Hosting & maintenance" intro (replaces the slider + add-on line). */
export const LANDING_PLANS_INTRO =
  'Choose a monthly hosting plan. Each plan includes everything in the plans before it. For maintenance, we analyze your request first — then quote and invoice.'
/** PLACEHOLDER (Sable): dashboard Plans page intro. */
export const DASHBOARD_PLANS_INTRO =
  'Hosting is billed monthly through Stripe. Pick the plan that fits; each one includes everything in the plans before it. Maintenance is quoted after we review your request — describe the work on the request form and we will follow up with pricing.'

/** PLACEHOLDER (Sable): claim step 3 body, replaces "Plans start at $35 a month." */
export const CLAIM_STEP3_BODY = `Hosting keeps your website online. Plans start at ${STARTER_PRICE} a month.`

/** PLACEHOLDER (Sable/Wren): help center + FAQ + help chat answers. */
export const HELP_WHAT_DO_I_PAY =
  `Hosting is required. It keeps your website online. Plans are ${PRICE_LIST} a month, and each plan includes everything in the ones before it. Maintenance starts at $50, up to $100. You'll see the exact price before you pay. Building the website is free.`
export const HELP_HOSTING_PLANS =
  `Hosting plans are ${PRICE_LIST} a month. Each plan includes everything in the ones before it. See Plans in your dashboard for what each plan adds. Already have an add-on? You keep it at the same price.`
export const HELP_REQUEST_CHANGES =
  `Yes. ${INCLUDED_EDIT_FROM.name} (${dollars(INCLUDED_EDIT_FROM.monthlyCents)}) and higher plans include one small edit each billing period. For other changes, request maintenance from your dashboard. Maintenance starts at $50, up to $100. You'll see the exact price before you pay.`
export const HELP_HIDDEN_FEES =
  "No. You pay for monthly hosting, which is required. One-time maintenance or a buyout costs extra only if you request it. Building your website is free, and you'll see the price before you pay."
export const HELP_SECURITY = 'Every site includes an SSL certificate, so it loads over a secure https connection.'
export const HELP_PLANS_GUIDE_TITLE_LINE = 'Plans: Choose a hosting plan, or request maintenance'
export const HELP_PLANS_GUIDE_DESCRIPTION = 'Compare hosting plans for your business'
/** Monthly edit note in the help chat (Fast lane+ and legacy Plus/Pro). */
export const HELP_CHAT_INCLUDED_EDIT_NOTE = 'Your plan includes one small edit each billing period.'

/** PLACEHOLDER (Sable/Wren): switching plans in the app (src/lib/stripe/change-plan.ts). */
export const CHANGE_PLAN_BUTTON = (name: string) => `Switch to ${name}`
export const CHANGE_PLAN_CURRENT = 'Your current plan'
export const CHANGE_PLAN_HELP =
  "Moving up starts right away, and you pay only the difference for the rest of this billing period. Moving down starts at your next billing date, so you keep what you paid for until then."
export const CHANGE_PLAN_UPGRADED = (name: string) =>
  `You're now on ${name}. We charged the difference for the rest of this billing period.`
export const CHANGE_PLAN_SCHEDULED = (name: string, date: string) =>
  `You'll move to ${name} on ${date}. You keep your current plan until then.`
export const CHANGE_PLAN_UNCHANGED = "You're on this plan. Any planned change has been cancelled."
export const CHANGE_PLAN_ENDING = 'Your plan is set to end. Resume it first, then switch.'
export const CHANGE_PLAN_PAYMENT_FAILED =
  "We couldn't charge your card, so your plan didn't change. Update your payment method in Manage billing and try again."
export const CHANGE_PLAN_UNAVAILABLE = "We couldn't change your plan right now. Try again, or email support@freeplug-in.dev."
/**
 * PROPOSED for Sable, NOT wired: the [STRICT] double-charge message (active-subscription.ts
 * ALREADY_HAS_PLAN_MESSAGE, "Use Manage billing to change it.") stays until Sable re-locks it;
 * Manage billing no longer switches plans (portal switching is off, moves happen on Plans).
 */
export const ALREADY_HAS_PLAN_SWITCH =
  'You already have an active hosting plan. To change it, pick a plan on the Plans page and choose Switch.'
