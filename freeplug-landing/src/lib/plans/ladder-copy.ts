import { PLAN_STEPS, customerAiEditsPerMonth, showAiEditQuota, stepById, type PlanPerk, type PlanStep, type PlanStepId } from './ladder'

/** "$35" style, from ladder.ts (never hard-code a price in copy). */
const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
/** "$35, $55 or $65", built from the SELLABLE steps in PLAN_STEPS (coming-soon steps not priced). */
const PRICE_LIST = (() => {
  const all = PLAN_STEPS.filter((s) => s.sellable).map((s) => dollars(s.monthlyCents))
  return all.length > 1 ? `${all.slice(0, -1).join(', ')} or ${all[all.length - 1]}` : (all[0] ?? '')
})()
const STARTER_PRICE = dollars(stepById('starter').monthlyCents)
const INCLUDED_EDIT_FROM = PLAN_STEPS.find((s) => s.adds.includes('includedSmallEdit'))!

/**
 * Hosting-ladder customer copy. ALL strings here are PLACEHOLDERS drafted from Aria's card
 * (section 7) until Sable Quinn / Wren deliver final [STRICT] wording. Swap strings here only; no
 * other file hard-codes ladder copy. Rules for the final copy: no reply-time promise beyond "by end
 * of next business day (Mon–Fri, excluding holidays)" as a target (pending Ezequiel), no refund or
 * guarantee wording, no ranking or lead guarantees, "call button taps" not
 * "calls", and nothing about backups or downtime alerts until they are built.
 */
export const LADDER_COPY_STATUS = 'PLACEHOLDER: pending Sable/Wren final copy' as const

/**
 * PLACEHOLDER (Sable/Wren; Aria 12:25 wording). The small-edit turnaround is a TARGET: no refund,
 * credit or guarantee wording anywhere (ladder-copy.test.ts checks). Holidays: ladder.ts.
 */
export const NEXT_BUSINESS_DAY_TARGET = 'by end of next business day (Mon–Fri, excluding holidays)'

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
  nextBusinessDayEdits: `Small edits: ${NEXT_BUSINESS_DAY_TARGET}.`,
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
export const NEXT_BUSINESS_DAY_LINE = `Small edits: ${NEXT_BUSINESS_DAY_TARGET}.`
/**
 * AI-edit line for a step card. null while showAiEditQuota (ladder.ts) is false, which it stays until
 * the AI editor ships (Aria, Oct 3 12:56). PLACEHOLDER wording for when it ships.
 */
export const aiEditsLine = (step: Pick<PlanStep, 'aiEditsPerMonth'>, show: boolean = showAiEditQuota): string | null => {
  const n = customerAiEditsPerMonth(step, show)
  return n === null ? null : `AI edits: ${n} a month`
}

/**
 * Step marked "Most popular" on the cards; null for none. Off (Lina, Oct 3 round 4): no sales data
 * behind it, and with three sellable steps it reads as a push. Revisit with real numbers.
 */
export const MOST_POPULAR_STEP: PlanStepId | null = null

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

/** PLACEHOLDER (Sable/Wren): steps with sellable=false in ladder.ts ("coming soon"). */
export const COMING_SOON_LABEL = 'Coming soon'
export const STEP_NOT_SELLABLE_MESSAGE = (name: string) =>
  `${name} isn't available yet. Choose another plan for now.`

/** PLACEHOLDER (Sable/Wren): switching plans in the app (src/lib/stripe/change-plan.ts). */
export const CHANGE_PLAN_BUTTON = (name: string) => `Switch to ${name}`
export const CHANGE_PLAN_CURRENT = 'Your current plan'
export const CHANGE_PLAN_HELP =
  "Moving up starts right away, and you pay only the difference for the rest of this billing period. Moving down starts at your next billing date, so you keep what you paid for until then."
export const CHANGE_PLAN_UPGRADED = (name: string) =>
  `You're moving to ${name}. We charged the difference for the rest of this billing period. Your new plan shows here as soon as Stripe confirms it, usually within a minute.`
export const CHANGE_PLAN_SCHEDULED = (name: string, date: string) =>
  `You'll move to ${name} on ${date}. You keep your current plan until then.`
export const CHANGE_PLAN_UNCHANGED = "You're on this plan. Any planned change has been cancelled."
export const CHANGE_PLAN_ENDING = 'Your plan is set to end. Resume it first, then switch.'
export const CHANGE_PLAN_PAYMENT_FAILED =
  "We couldn't charge your card, so your plan didn't change. Update your payment method in Manage billing and try again."
export const CHANGE_PLAN_PAYMENT_FAILED_PENDING_LOST =
  "We couldn't charge your card, so your plan didn't change. Your planned switch at the next billing date was cancelled too; pick it again if you still want it."
export const CHANGE_PLAN_UNAVAILABLE = "We couldn't change your plan right now. Try again, or email support@freeplug-in.dev."
/** Plans page: a downgrade waiting for the next billing date. */
export const PENDING_CHANGE_LINE = (name: string, date: string) =>
  `Changing to ${name} on ${date}. You keep your current plan until then.`
export const KEEP_PLAN_BUTTON = (name: string) => `Keep ${name}`
/** Cancel page, when a downgrade is pending (Stripe can't cancel a plan with a planned switch). */
export const CANCEL_WITH_PENDING_NOTE = (name: string, date: string) =>
  `You have a switch to ${name} planned for ${date}. Canceling your plan also cancels that switch.`
export const CANCEL_PLAN_BUTTON = 'Cancel my plan at the end of this billing period'
/** PLACEHOLDER (Sable/Wren): Plans page billing (Aria, Oct 3 12:56). */
export const BILLING_PENDING_NOTICE = (name: string, date: string) =>
  `You have a switch to ${name} planned for ${date}, so billing is handled here until then. You can update your card and see your invoices below.`
export const BILLING_UNAVAILABLE = "We couldn't open billing right now. Try again, or email support@freeplug-in.dev."
export const BILLING_HEADING = 'Billing'
export const UPDATE_CARD_BUTTON = 'Update card'
export const CARD_UPDATED_NOTICE = 'Thanks. If you saved a new card, we use it for your next payment.'
export const INVOICES_HEADING = 'Invoices'
export const INVOICES_EMPTY = 'No invoices yet.'
export const INVOICE_STATUS_LABEL = { paid: 'Paid', open: 'Due', uncollectible: 'Unpaid' } as const
export const VIEW_INVOICE = 'View'
export const DOWNLOAD_INVOICE_PDF = 'PDF'

/**
 * PROPOSED for Sable, NOT wired: the [STRICT] double-charge message (active-subscription.ts
 * ALREADY_HAS_PLAN_MESSAGE, "Use Manage billing to change it.") stays until Sable re-locks it;
 * Manage billing no longer switches plans (portal switching is off, moves happen on Plans).
 */
export const ALREADY_HAS_PLAN_SWITCH =
  'You already have an active hosting plan. To change it, pick a plan on the Plans page and choose Switch.'

/**
 * FINAL (Sable, /workspace/copy/freeplug-ladder-round4-copy-2026-10-03.md, Oct 3 ~2:30 PM CT) for Lina's
 * round-4 layout (hosting-ladder-ux-LINA-2026-10-03.md). The upgrade confirm line is Aria's wording (1:34 PM),
 * kept word for word.
 */
export const LAYOUT_COPY_STATUS = 'FINAL (Sable, Oct 3 2:30 PM): Lina round-4 layout strings' as const
/** [Final, Sable] Plans page "Your plan" strip (was the hard-coded "Current plan: …" under the list). */
export const CURRENT_PLAN_LINE = (line: string) => `Current plan: ${line}`
/** [Final, Sable] Badge on the step a pending downgrade moves to, so the list matches the pending box. */
export const STARTS_ON_BADGE = (date: string) => `Starts ${date}`
/** [Final, Sable] Phone only: the collapsed Coming soon group. */
export const SEE_COMING_SOON = (count: number) => `Plans coming soon (${count})`
/** [Final, Sable] Claim step 3 button, names the pick (replaces "Choose this plan"). */
export const CHOOSE_STEP_BUTTON = (name: string) => `Choose ${name}`
/** [Final, Sable] Claim step 4 summary: text link back to step 3 (only before the card is saved). */
export const CLAIM_CHANGE_PLAN_LINK = 'Change plan'
/** [Final, Sable] Switching card: selected = current plan (button disabled). */
export const CHANGE_PLAN_PICK_TO_SWITCH = 'Choose a different plan to switch'
/** [Final, Sable] Switching card: selected step is higher (starts now). */
export const CHANGE_PLAN_BUTTON_NOW = (name: string) => `Switch to ${name} now`
/** [Final, Sable] Switching card: selected step is lower (starts at the next billing date). */
export const CHANGE_PLAN_BUTTON_ON = (name: string, date: string) => `Switch to ${name} on ${date}`
/** [Final, Sable] CHANGE_PLAN_HELP split in two: the line under an upgrade button… */
export const CHANGE_PLAN_HELP_UP =
  'Starts right away. Today you pay only the difference for the rest of this billing period, and your billing date stays the same.'
/** [Final, Sable] …and the line under a downgrade button. */
export const CHANGE_PLAN_HELP_DOWN =
  'Starts on your next billing date, when the lower price begins. Nothing is charged today, and you keep your current plan until then.'
/** [Final, Sable] Upgrade confirm, while the server preview runs (never a fake amount). */
export const UPGRADE_CALCULATING = 'Checking the amount…'
/** [Final: Aria's wording 1:34 PM, kept by Sable] Upgrade confirm with the previewed amounts. */
export const UPGRADE_CONFIRM_LINE = (name: string, today: string, monthly: string, date: string) =>
  `Switch to ${name} now? We'll charge ${today} today, then ${monthly}/month starting ${date}.`
/** [Final, Sable] Upgrade confirm when the preview failed. */
export const UPGRADE_CONFIRM_FALLBACK = (name: string) =>
  `Switch to ${name} now? We'll charge the difference for the rest of this billing period today.`
/** [Final, Sable] */
export const UPGRADE_CONFIRM_BUTTON = 'Confirm'
/** [Final, Sable] */
export const UPGRADE_CANCEL_BUTTON = 'Not now'
/** [Final, Sable] Grey line after the confirm expired (10 minutes) or the server refused a stale amount. */
export const UPGRADE_PREVIEW_EXPIRED = 'That amount is out of date. Use the Switch button again to see the current amount.'
/** [Final, Sable] A second Confirm arrived while the first was still going through (charged once). */
export const UPGRADE_IN_PROGRESS = 'Your plan change is already going through. Refresh in a moment to see it.'
/** [Final, Sable] Dashboard home plan card: plain link to the Plans page. */
export const CHANGE_PLAN_LINK = 'Change plan'

/**
 * Help "How do I update my payment method?" (help page b-2 and the help chat 'payment-method'): the
 * locked answer plus Sable's sentence for Manage billing while a switch is planned (Oct 3 ~2:30 PM,
 * item 40). One constant so the page and the chat can't drift. Waits for Sable's re-lock of
 * help/page.tsx:79 in the locked English file (the chat entry is marked pendingCopy until then).
 */
export const HELP_PAYMENT_METHOD =
  'Go to your dashboard and open Manage billing. After your first payment, you can manage your billing and payment method there. If you have a plan switch planned, Manage billing opens Billing on your Plans page instead, where you can update your card and see your invoices.'
