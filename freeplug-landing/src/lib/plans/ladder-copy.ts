import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from '../site'
import { ADDON_STEP_LIMITS, PLAN_STEPS, addonById, customerAiEditsPerMonth, showAiEditQuota, stepById, type AddonId, type PlanPerk, type PlanStep, type PlanStepId } from './ladder'

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
  available > 1
    ? used >= available
      ? 'Your included edits: all used this billing period.'
      : `Your included edits: ${available - used} of ${available} available this billing period.`
    : used >= available
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
/** [Sable] FINAL (4:32 PM CT): a plan switch while the plan is set to end; names the real button. */
export const CHANGE_PLAN_ENDING = 'Your plan is set to end. Choose Resume plan first, then switch.'
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
/**
 * [Final, Sable, Oct 3 ~5:52 PM; Vera N1] Cancel page "Cancel Your Subscription" box. The only cancel is
 * the in-app button at the bottom of that box (the billing portal's cancel is off since 4d02033). Replaces
 * the old portal line and its access sentence (one paragraph, so the access sentence shows once).
 */
export const CANCEL_IN_APP_LINE =
  'If you still want to cancel, use the button at the bottom of this box. Your access continues until the end of your current billing period.'

/**
 * [Sable] FINAL (4:32 PM CT; Aria Oct 3 4:05 PM): "Resume plan" failed. The customer is never sent to the
 * billing portal; they get the support contact (src/lib/site.ts) instead.
 */
export const RESUME_FAILED_MESSAGE = `We couldn't resume your plan, so it's still set to end. Please try again in a moment, or contact us at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE_DISPLAY} and we'll help.`
/**
 * [Sable] FINAL (5:11 PM CT; Vera B2): "Resume plan" while another plan change holds the lock AND a
 * fresh read from Stripe shows the plan is still set to end. (Already resumed = the success state.)
 */
export const RESUME_BUSY_MESSAGE = 'Your plan is already being updated. Please try again in a moment.'
/** [Sable] FINAL (4:32 PM CT): the in-app cancel (the only cancel) failed. */
export const CANCEL_FAILED_MESSAGE = `We couldn't cancel your plan just now, so nothing has changed. Please try again in a moment, or contact us at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE_DISPLAY}.`
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
/** [Sable] FINAL (4:32 PM CT): invoice list, the tip as its own part ("Plan $55.00 · Optional tip $4.00"). */
export const INVOICE_PLAN_PART = (amount: string) => `Plan ${amount}`
export const INVOICE_TIP_PART = (amount: string) => `Optional tip ${amount}`
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
/**
 * [Final, Sable] Switching card: selected step is lower (starts at the next billing date). On the button
 * `date` is the short form ("Nov 3", formatShortPlanDate) so it fits on one line at 375 (Lina, round 5b);
 * the hint lines keep the full date.
 */
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
/** [Final, Sable 3:19 PM CT] Request page: text link to /dashboard/cancel under the close-blocked message (Lina, round 5b). */
export const CANCEL_OPTIONS_LINK = 'Cancel options'

/**
 * [Sable, Oct 3 6:19 PM CT] Grandfathered plan display name (cancel page cards, dashboard list and Recent
 * activity; built by planDisplayName in src/lib/stripe/plan-line.ts): "Hosting + Pro add-on", with a tip
 * "Hosting + Pro add-on + $4 tip" (PLAN_STRIP_TIP), and "Hosting plan" with no add-on. The ending alert
 * keeps its own wording ("Your hosting plan and Pro add-on will end…", grandfatheredAlertName).
 */
export const GRANDFATHERED_HOSTING_ONLY_NAME = 'Hosting plan'
/** [Sable 6:19 PM] The hosting part when an add-on follows: "Hosting + Pro add-on". */
export const GRANDFATHERED_HOSTING_SHORT = 'Hosting'
/** [Sable 6:19 PM] A retired add-on by its tier name: "Pro add-on". */
export const LEGACY_ADDON_NAME = (tierName: string) => `${tierName} add-on`

/**
 * Help "How do I update my payment method?" (help page b-2 and the help chat 'payment-method'): the
 * locked answer plus Sable's sentence for Manage billing while a switch is planned (Oct 3 ~2:30 PM,
 * item 40). One constant so the page and the chat can't drift. Waits for Sable's re-lock of
 * help/page.tsx:79 in the locked English file (the chat entry is marked pendingCopy until then).
 */
export const HELP_PAYMENT_METHOD =
  'Go to your dashboard and open Manage billing. After your first payment, you can manage your billing and payment method there. If you have a plan switch planned, Manage billing opens Billing on your Plans page instead, where you can update your card and see your invoices.'

/**
 * FINAL (Sable, /workspace/copy/freeplug-ladder-round4-copy-2026-10-03.md "Added 2:20 PM CT"; Aria said
 * yes). Upgrade confirm extras and the tip-ends lines.
 */
/** [Final, Sable 2:20 PM] Upgrade confirm when the preview total is exactly $0.00 (a partial credit keeps UPGRADE_CONFIRM_LINE). */
export const UPGRADE_CONFIRM_ZERO = (name: string, monthly: string, date: string) =>
  `Switch to ${name} now? Nothing is charged today. Then ${monthly}/month starting ${date}.`
/** [Final, Sable 2:20 PM] Under the upgrade confirm, only when a downgrade is planned. */
export const UPGRADE_REPLACES_PENDING = (pendingName: string) => `This replaces your planned switch to ${pendingName}.`
/** [Final, Aria's wording via Sable 2:20 PM] Upgrade (immediate), only when the customer has a tip. */
export const PLAN_CHANGE_TIP_ENDS = (tip: string) => `Your ${tip} monthly tip ends with this switch.`
/** [Final, Sable 2:20 PM] Downgrade (scheduled), only with a tip: under the downgrade button and in the pending box. */
export const PLAN_CHANGE_TIP_ENDS_ON = (tip: string, date: string) => `Your ${tip} monthly tip ends on ${date}, when this switch starts.`

/**
 * [Sable] FINAL: the tipping system (Sable, Oct 3, 3:20 PM CT,
 * /workspace/copy/freeplug-ladder-round5-tip-copy-2026-10-03.md). An optional monthly extra to support
 * Freeplug; it never changes what a plan includes. Wording rules: "tip" / "optional extra to support
 * Freeplug", never "donation" (ladder-copy.test.ts checks). Swap strings here only.
 */
export const TIP_COPY_STATUS = 'FINAL: Sable, Oct 3, 3:20 PM CT (tipping system)' as const
/** [Sable] Slider label (the range input's visible label). */
export const TIP_SLIDER_LABEL = 'Optional tip to support Freeplug'
/** [Sable] Grey line under the slider. */
export const TIP_SLIDER_HELP = "An optional extra to support Freeplug. It doesn't change what your plan includes."
/** [Sable] Screen readers: the slider value in dollars (aria-valuetext). */
export const TIP_VALUETEXT = (total: string, tip: string | null) =>
  tip ? `${total} a month, including a ${tip} tip` : `${total} a month, no tip`
/** [Sable] Readable live total next to the slider ("$65 + $5 tip = $70/month"). */
export const TIP_TOTAL_LINE = (price: string, tip: string | null, total: string) =>
  tip ? `${price} + ${tip} tip = ${total}/month` : `${total}/month, no tip`
/** [Sable] FINAL (3:19 PM CT): hint between the total line and the bar (Lina, round 5b). */
export const TIP_SLIDER_HINT = "Pick a tip if you'd like, or leave it at No tip."
/** [Sable] FINAL (3:19 PM CT): end labels under the bar, in tip amounts (never plan totals). */
export const TIP_END_NONE = 'No tip'
export const TIP_END_MAX = (max: string) => `${max} tip`
/** [Sable] FINAL (3:19 PM CT): aria-labels of the − / + buttons beside the bar ($1 each). */
export const TIP_LOWER_LABEL = 'Lower tip by $1'
export const TIP_RAISE_LABEL = 'Raise tip by $1'
/**
 * [Sable] FINAL (4:32 PM CT): the read-only row in "Your monthly tip" while a switch is planned (the bar
 * is hidden). Matches "Your $X monthly tip ends…".
 */
export const TIP_LOCKED_AMOUNT = (tip: string) => `${tip} monthly tip`
/** [Sable] FINAL (3:19 PM CT; unchanged at 4:32): grey line under the locked row; `date` is the switch date ("November 3, 2026"). */
export const TIP_LOCKED_NOTE = (date: string) =>
  `Your tip ends on ${date}, when your planned switch starts. You can choose a new tip after that.`
/** [Sable] Nudge when the total is within TIP_NUDGE_WINDOW_DOLLARS ($5) below the next sellable plan. */
export const TIP_NUDGE = (next: string, price: string, perk: string) =>
  `${next} is ${price} a month and adds ${perk}. Want that instead? Keeping your tip is fine too.`
/** [Sable] Nudge button: picks the next plan (no charge; the normal flow continues). */
export const TIP_NUDGE_BUTTON = (next: string) => `Choose ${next}`
/** [Sable] Short "main perk" phrases for the nudge (the first perk a step adds). */
export const TIP_NUDGE_PERK: Record<PlanPerk, string> = {
  priorityQueue: 'a place ahead of lower plans when you ask for changes',
  includedSmallEdit: 'one small edit by us each billing period',
  nextBusinessDayEdits: `small edits ${NEXT_BUSINESS_DAY_TARGET}`,
  leadsReport: 'a monthly report on visits, form requests and call button taps',
  quoteAlerts: 'an email the moment someone asks for a quote',
  gbpManaged: 'Google Business Profile upkeep',
  reviewKit: 'a review request kit',
  seasonalRefresh: 'a seasonal refresh',
  quarterlyCall: 'a 15-minute planning call every quarter',
  doneForYouEdits: 'done-for-you edits',
}
/** [Sable] Plan strip and claim summary: the tip as its own part ("Fast lane · $65/month + $5 tip"). */
export const PLAN_STRIP_TIP = (tip: string) => ` + ${tip} tip`
/** [Sable] Plans page: heading of the tip box for a live plan. */
export const TIP_CHANGE_HEADING = 'Your monthly tip'
/** [Sable] Plans page: grey line in the tip box. */
export const TIP_CHANGE_NOTE = 'Changes start with your next bill. Nothing is charged today. To stop your tip, set it to No tip.'
/** [Sable] Plans page: button that shows the next bill before saving. */
export const TIP_CHANGE_BUTTON = 'Update tip'
/** [Sable] Plans page: the tip-change confirmation ("Your next bill will be $X on <date>."). */
export const TIP_NEXT_BILL = (amount: string, date: string) => `Your next bill will be ${amount} on ${date}.`
/** [Sable] Same, when the date is unknown. */
export const TIP_NEXT_BILL_NO_DATE = (amount: string) => `Your next bill will be ${amount}.`
/** [Sable] Plans page: after saving; `nextBill` is the TIP_NEXT_BILL line the customer confirmed. */
export const TIP_CHANGED = (nextBill: string) => `Your tip is updated. ${nextBill}`
/** [Sable] Plans page: a switch is planned, so the tip can't change now. */
export const TIP_CHANGE_PENDING =
  "Tips can't be changed while a plan switch is planned. Once the switch starts, you can choose a new tip."
/** [Sable] FINAL (4:32 PM CT, new): tip box only, while the plan is set to end (replaces the plan-switch line there). */
export const TIP_CHANGE_ENDING = "Your plan is set to end, so your tip can't be changed. Choose Resume plan first."
/** [Sable] Plans page: grandfathered plan (no slider). */
export const TIP_NOT_FOR_PLAN = "Tips aren't available on your plan."
/** [Sable] Server refused the amount (outside the plan's range). */
export const TIP_OUT_OF_RANGE = 'Choose a tip within the range on the slider.'
/** [Sable] */
export const TIP_CHANGE_UNAVAILABLE = "We couldn't change your tip right now. Try again, or email support@freeplug-in.dev."
/**
 * [Sable] Another tip change for this customer holds the plan-change lock (plan-change-lock-server.ts),
 * e.g. a double-click or a second tab. Shown instead of UPGRADE_IN_PROGRESS on the tip paths.
 */
export const TIP_IN_PROGRESS = 'Your tip change is already going through. Refresh in a moment to see it.'

// ------------------------------------------------------------------ add-ons (Oct 4, Lina's block)
// Card lines + charge note: Sable, approved by Ezequiel (Oct 4 8:28 / 8:31 AM). Other lines here are
// placeholders for Sable unless marked. Prices always come from ladder.ts ADDONS, never typed in copy.

export const ADDONS_HEADING = 'Add-ons'
/** Header right side, Starter selected only: "up to $15/month on Starter" (from ADDON_STEP_LIMITS). */
export const ADDONS_STARTER_CAP_NOTE = `up to ${dollars(ADDON_STEP_LIMITS.starter?.maxAddonCents ?? 0)}/month on Starter`
export const ADDON_NAMES: Record<AddonId | 'visitor_snapshot', string> = {
  small_edit: '+1 small edit',
  big_change: 'Big change',
  visitor_snapshot: 'Visitor snapshot',
}
/**
 * [Sable, approved] Perk line under the price. `withIncludedEdit`: the step already includes 1 small
 * edit (Fast lane and up); Starter and Priority get the plain line.
 */
export function addonPerkLine(id: AddonId | 'visitor_snapshot', opts: { withIncludedEdit?: boolean } = {}): string {
  if (id === 'small_edit')
    return opts.withIncludedEdit
      ? "One more small edit on top of the one your plan includes. Unused edits don't roll over."
      : "One small edit by us each billing period, like new hours, a photo swap or a price change. Unused edits don't roll over."
  if (id === 'big_change')
    return "One larger change each billing period, up to about an hour of work on your existing pages. For example, adding a section, a new service with photos, a gallery refresh, or rewriting one page. Unused changes don't roll over."
  return 'A monthly email with how many people visited your site.'
}
/** [Sable, approved] Gray line under the Big change perk line. */
export const BIG_CHANGE_BIGGER_NOTE = "Need something bigger, like a new page or feature? We'll quote it as maintenance first, and you can still use this month's change."
/** [Sable, approved] Gray charge note on each live add-on card; {price} from ADDONS. */
export function addonChargeNote(cents: number): string {
  const price = dollars(cents)
  return `Turning it on charges ${price} now for this billing period, then ${price} each month. If you turn it off, it stays on until the period ends.`
}
/**
 * [Sable, approved] Help chat review step: a Starter plan without the +1 small edit add-on asks for a
 * small edit. The AI-builder sentence shows only while showAiEditQuota (ladder.ts) is true.
 */
export function starterSmallEditAddonLine(show: boolean = showAiEditQuota): string {
  const price = dollars(addonById('small_edit')!.monthlyCents)
  const base = `Small edits are ${price} with the ${ADDON_NAMES.small_edit} add-on. Turn it on and we'll take care of it this month. You can turn it off anytime.`
  return show ? `${base} Or make the change yourself with the AI builder, at no extra cost.` : base
}
export const addonPriceLine = (cents: number) => `${dollars(cents)}/month`
/** Inline confirm when turning one on would push Starter past its total: never lower a tip silently. */
export const addonTipDropQuestion = (tipDollars: number, name: string) => `Your tip will drop to $${tipDollars}. Turn on ${name}?`
export const ADDON_TURN_ON = 'Turn on'
/** Live plan, no tip change: the inline confirm's question. */
export const addonTurnOnQuestion = (name: string) => `Turn on ${name}?`
/** Tip card next to the add-ons block: the tip amount only (the one total is in the action area). */
export const tipAmountLine = (tipDollars: number) => (tipDollars > 0 ? `$${tipDollars} tip` : 'No tip')
export const ADDON_CANCEL = 'Cancel'
/** [Sable] Live plan confirm: turning one on charges its full monthly price now (never prorated, Aria Oct 4). */
export const addonChargeNowLine = (amountDueCents: number) => `We'll charge ${dollars(amountDueCents)} now for this billing period.`
export const ADDON_CHARGE_NOW_FALLBACK = "We'll charge the full monthly price now for this billing period."
export const addonThenLine = (nextCents: number, date: string | null) =>
  date ? `Then ${dollars(nextCents)}/month from ${date}.` : `Then ${dollars(nextCents)}/month.`
/** Live plan: turning one off is at the end of the billing period. */
export const addonOffQuestion = (name: string, date: string | null) =>
  date ? `Turn off ${name}? It stays on until ${date}, then it ends.` : `Turn off ${name}? It stays on until the end of this billing period.`
export const ADDON_TURN_OFF = 'Turn off'
export const addonEndsLine = (date: string | null) => (date ? `Ends ${date}` : 'Ends at the end of this billing period')
export const ADDON_KEEP = 'Keep it'
export const ADDON_ON_DONE = 'Add-on is on.'
export const addonOffDone = (date: string | null) => (date ? `Add-on ends ${date}.` : 'Add-on ends at the end of this billing period.')
export const ADDON_KEEP_DONE = 'Add-on stays on.'
export const addonsLockedBySwitch = (date: string | null) =>
  date ? `Add-ons can change after ${date}, or keep your current plan.` : 'Add-ons can change after your plan switch, or keep your current plan.'
export const ADDONS_LOCKED_BY_REMOVAL = 'An add-on is set to end. Keep it, or turn more on after that date.'
export const ADDONS_LEGACY_NOTE = 'Add-ons are for the current plans. Pick a plan above to add them.'
export const ADDON_ERROR = "That didn't go through. Nothing changed. Try again."
export const ADDON_PAYMENT_FAILED = 'The card was not charged, so the add-on is still off.'
/** [Sable] Charged, but Stripe did not add the add-on; the charge was reversed automatically (credit note refund). */
export const ADDON_NOT_APPLIED_REFUNDED = "That didn't go through, so the add-on is still off. The charge has been reversed to your card."
/** [Sable] Charged, Stripe did not add it, and the automatic reversal failed too (logged for admin). */
export const ADDON_NOT_APPLIED_CHARGED = "That didn't go through, so the add-on is still off. Email support@freeplug-in.dev and we'll sort out the charge."
/** Server refusals. */
export const ADDON_TURN_OFF_FIRST = 'Turn off an add-on first'
export const ADDON_PENDING_SWITCH = 'A plan switch is planned. Add-ons can change after it, or keep your current plan.'
export const ADDON_PENDING_REMOVAL = 'An add-on is set to end. Keep it first, or wait until it ends.'
/** Upgrade confirm: one gray line listing the add-ons that are on (omitted when none). */
export const addonsStayOnLine = (names: readonly string[] | string) => `Your add-ons stay on: ${([] as string[]).concat(names).join(', ')}.`
/** Pending switch line on the Plans page / dashboard when the plan switch keeps add-ons. */
export const addonsPendingEndLine = (names: readonly string[] | string, date: string) => {
  const list = ([] as string[]).concat(names)
  return `${list.join(', ')} ${list.length === 1 ? 'ends' : 'end'} ${date}.`
}
/** One total (action area / sticky bar): "Starter $35 · Add-ons $10.75 · Tip $4" then "$49.75/month". */
export function planTotalBreakdown(stepName: string, stepCents: number, addonCents: number, tipCents: number): string {
  const parts = [`${stepName} ${dollars(stepCents)}`]
  if (addonCents > 0) parts.push(`Add-ons ${dollars(addonCents)}`)
  if (tipCents > 0) parts.push(`Tip ${dollars(tipCents)}`)
  return parts.join(' · ')
}
export const planTotalLine = (totalCents: number) => `${dollars(totalCents)}/month`
/** Dashboard: Big change uses this period. */
export const bigChangeLine = (used: number, of: number) => `Big change: ${used} of ${of} used this period`
/** Admin. */
export const ADMIN_MARK_BIG_CHANGE = 'Mark as big change'
/** Plan strip / dashboard: add-ons part ("+ $10.75 add-ons"). */
export const planStripAddons = (cents: number) => ` + ${dollars(cents)} add-ons`
/** Cancel page price line with add-ons: "$35.00 + $10.75 add-ons + $4.00 tip = $49.75/month" (tip part only when > 0). */
export const ADDON_TOTAL_LINE = (plan: string, addons: string, tip: string | null, total: string) =>
  `${plan} + ${addons} add-ons${tip ? ` + ${tip} tip` : ''} = ${total}/month`
