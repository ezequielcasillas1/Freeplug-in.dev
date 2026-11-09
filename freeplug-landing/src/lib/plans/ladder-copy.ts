import { formatAmount, formatAmountCents } from '@/lib/format/keep-together'
import { EDITS_COPY_ES, needMoreEditsLine } from './edits-copy'
import { editPackFor } from './edit-allowance'
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from '../site'
import { ADDON_STEP_LIMITS, PLAN_STEPS, addonById, customerAiEditsPerMonth, showAiEditQuota, stepById, type AddonId, type PlanPerk, type PlanStep, type PlanStepId } from './ladder'
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/i18n/config'
import { formatList } from '@/i18n/format'
import { translatorFor, translatorFromMessages, type Translate } from '@/i18n/translate'
import type { Messages } from '@/i18n/messages'

/**
 * Hosting-ladder customer copy (Spanish build, Oct 4: card §5 C1/C3). Every string now lives in
 * messages/<locale>.json; this module only fills in prices and names. `ladderCopy(locale)` returns
 * the copy for one language; the named exports below are the ENGLISH copy (en.json, the English
 * lock), kept so server code and tests that import them keep working. Customer screens use
 * `ladderCopy(locale)` / useLadderCopy(). Plan and add-on NAMES stay English (card §9 Q3).
 * Rules for the copy (unchanged): no reply-time promise beyond the next-business-day TARGET, no
 * refund or guarantee wording, no ranking or lead guarantees, "call button taps" not "calls", and
 * "tip" never "donation" (ladder-copy.test.ts checks).
 */
export const LADDER_COPY_STATUS = 'PLACEHOLDER: pending Sable/Wren final copy' as const
export const LAYOUT_COPY_STATUS = 'FINAL (Sable, Oct 3 2:30 PM): Lina round-4 layout strings' as const
export const TIP_COPY_STATUS = 'FINAL: Sable, Oct 3, 3:20 PM CT (tipping system)' as const

/** "$35" style, from ladder.ts (never hard-code a price in copy). USD in every locale (card R3). */
const dollars = (cents: number) => formatAmount(cents)
const wholeDollars = (n: number) => `$${n}`
/** Two decimals always ("$5.00 + $0.35"): the carried split adds cents to whole dollars. */
const cents2 = (cents: number) => formatAmountCents(cents)
const STARTER_PRICE = dollars(stepById('starter').monthlyCents)
const INCLUDED_EDIT_FROM = PLAN_STEPS.find((s) => s.adds.includes('includedSmallEdit'))!

/**
 * Step marked "Most popular" on the cards; null for none. Off (Lina, Oct 3 round 4): no sales data
 * behind it, and with three sellable steps it reads as a push. Revisit with real numbers.
 */
export const MOST_POPULAR_STEP: PlanStepId | null = null

const PERKS: readonly PlanPerk[] = ['priorityQueue', 'includedSmallEdit', 'nextBusinessDayEdits', 'leadsReport', 'quoteAlerts', 'gbpManaged', 'reviewKit', 'seasonalRefresh', 'quarterlyCall', 'doneForYouEdits']
/**
 * Aria, Oct 4 9:27: why an add-on charge was refunded automatically (self-heal). Shown on the Plans page
 * and in the refund email.
 */
export type AddonRefundReason = 'switch_pending' | 'removal_pending' | 'period_ended' | 'tip_unconfirmed' | 'plan_ended' | 'not_added' | 'turned_off'
const ADDON_REFUND_REASON_IDS: readonly AddonRefundReason[] = ['switch_pending', 'removal_pending', 'period_ended', 'tip_unconfirmed', 'plan_ended', 'not_added', 'turned_off']
export const isAddonRefundReason = (v: unknown): v is AddonRefundReason => typeof v === 'string' && (ADDON_REFUND_REASON_IDS as readonly string[]).includes(v)
const STEP_IDS: readonly PlanStepId[] = ['starter', 'priority', 'fast_lane', 'leads', 'get_found', 'growth']

function build(t: Translate, locale: AppLocale) {
  /** "$35, $55 or $65": the SELLABLE steps in PLAN_STEPS (coming-soon steps not priced), Intl list. */
  const priceList = formatList(PLAN_STEPS.filter((s) => s.sellable).map((s) => dollars(s.monthlyCents)), locale, 'disjunction')
  const NEXT_BUSINESS_DAY_TARGET = t('plans.nextBusinessDayTarget')
  const perkLine = (p: PlanPerk) => (p === 'nextBusinessDayEdits' ? t('plans.smallEditsNextBusinessDay') : t(`plans.perkLines.${p}`))
  const ADDON_NAMES: Record<AddonId | 'visitor_snapshot', string> = {
    small_edit: t('addons.names.small_edit'),
    big_change: t('addons.names.big_change'),
    visitor_snapshot: t('addons.names.visitor_snapshot'),
  }
  const addonsLockedBySwitch = (date: string | null) => (date ? t('addons.lockedBySwitch', { date }) : t('addons.lockedBySwitchNoDate'))
  const ADDONS_LOCKED_BY_REMOVAL = t('addons.lockedByRemoval')
  /**
   * Sable, Oct 4 9:29: the refund line split by where the money went (card part / credit part). L-3: part
   * of the credit canceled a small charge still unbilled (no card part, so no delay line follows).
   */
  const addonRefundSplitLine = (cardCents: number, creditCents: number, carriedCents: number = 0): string => {
    if (carriedCents > 0 && cardCents === 0 && creditCents > carriedCents) {
      return t('addons.refundSplit.carried', { credit: dollars(creditCents - carriedCents), carried: dollars(carriedCents) })
    }
    if (cardCents > 0 && creditCents > 0) return t('addons.refundSplit.cardAndCredit', { card: dollars(cardCents), credit: dollars(creditCents) })
    if (creditCents > 0) return t('addons.refundSplit.credit', { credit: dollars(creditCents) })
    return t('addons.refundSplit.card', { card: dollars(cardCents) })
  }
  /** Sable 9:55: the card delay sentence, only when money went back to a card (its leading space joins it on). */
  const cardRefundDelay = (cardCents: number) => (cardCents > 0 ? ` ${t('addons.cardRefundDelay')}` : '')
  /** Aria, Oct 4 9:27: why an add-on charge was refunded automatically (self-heal), in plain words. */
  const ADDON_REFUND_REASONS = Object.fromEntries(
    ADDON_REFUND_REASON_IDS.map((id) => [id, (name: string) => t(`addons.refundReasons.${id}`, { name })])
  ) as Record<AddonRefundReason, (name: string) => string>
  return {
    /** The language this copy is in (for dates/amounts formatted next to it). */
    LOCALE: locale,
    NEXT_BUSINESS_DAY_TARGET,
    /**
     * Aria ruling 2 / Sable §3: cards keep the English plan and add-on NAME, with a one-line
     * Spanish gloss under it. Spanish only (the English name already says it): null in English.
     */
    PLAN_GLOSS: Object.fromEntries(STEP_IDS.map((id) => [id, locale === 'es' ? t(`plans.gloss.${PLAN_GLOSS_KEY[id]}`) : null])) as Record<PlanStepId, string | null>,
    ADDON_GLOSS: Object.fromEntries((['small_edit', 'big_change', 'visitor_snapshot'] as const).map((id) => [id, locale === 'es' ? t(`addons.gloss.${id}`) : null])) as Record<AddonId | 'visitor_snapshot', string | null>,
    STEP_BLURBS: Object.fromEntries(STEP_IDS.map((id) => [id, t(`plans.stepBlurbs.${id}`)])) as Record<PlanStepId, string>,
    PERK_LINES: Object.fromEntries(PERKS.map((p) => [p, perkLine(p)])) as Record<PlanPerk, string>,
    STARTER_BASE_LINES: [t('plans.starterBaseLines.hostingSslSecureHttps'), t('plans.starterBaseLines.emailSupportDuringSupport')] as readonly string[],
    LADDER_HEADING: t('plans.ladderHeading'),
    LADDER_SUBHEADING: t('plans.ladderSubheading'),
    MOST_POPULAR_LABEL: t('plans.mostPopularLabel'),
    EVERYTHING_IN: (name: string) => t('plans.everythingIn', { name }),
    PER_MONTH: t('plans.perMonth'),
    CONTINUE_TO_PAYMENT: t('plans.continueToPayment'),
    LEGACY_PLAN_NOTE: t('plans.legacyPlanNote'),
    LEGACY_PLAN_LABEL: t('plans.legacyPlanLabel'),
    INCLUDED_EDIT_LINE: (used: number, available: number) =>
      available > 1
        ? used >= available
          ? t('plans.includedEdits.allUsed')
          : t('plans.includedEdits.someLeft', { remaining: available - used, available })
        : used >= available
          ? t('plans.includedEdit.used')
          : t('plans.includedEdit.available', { remaining: available - used }),
    NEXT_BUSINESS_DAY_LINE: t('plans.smallEditsNextBusinessDay'),
    /** AI-edit line; null while showAiEditQuota (ladder.ts) is false (until the AI editor ships). */
    aiEditsLine: (step: Pick<PlanStep, 'aiEditsPerMonth'>, show: boolean = showAiEditQuota): string | null => {
      const n = customerAiEditsPerMonth(step, show)
      return n === null ? null : t('plans.aiEditsLine', { count: n })
    },
    LANDING_PLANS_INTRO: t('plans.landingPlansIntro'),
    DASHBOARD_PLANS_INTRO: t('plans.dashboardPlansIntro'),
    CLAIM_STEP3_BODY: t('claim.step3Body', { price: STARTER_PRICE }),
    HELP_WHAT_DO_I_PAY: t('help.answers.whatDoIPay', { priceList }),
    HELP_HOSTING_PLANS: t('help.answers.hostingPlans', { priceList }),
    HELP_REQUEST_CHANGES: t('help.answers.requestChanges', { name: INCLUDED_EDIT_FROM.name, price: dollars(INCLUDED_EDIT_FROM.monthlyCents) }),
    HELP_HIDDEN_FEES: t('help.answers.hiddenFees'),
    HELP_SECURITY: t('help.answers.security'),
    HELP_PLANS_GUIDE_TITLE_LINE: t('help.answers.plansGuideTitleLine'),
    HELP_PLANS_GUIDE_DESCRIPTION: t('help.answers.plansGuideDescription'),
    HELP_CHAT_INCLUDED_EDIT_NOTE: t('help.answers.chatIncludedEditNote'),
    COMING_SOON_LABEL: t('plans.comingSoonLabel'),
    STEP_NOT_SELLABLE_MESSAGE: (name: string) => t('plans.stepNotSellableMessage', { name }),
    CHANGE_PLAN_BUTTON: (name: string) => t('plans.change.button', { name }),
    CHANGE_PLAN_CURRENT: t('plans.change.current'),
    CHANGE_PLAN_HELP: t('plans.change.help'),
    CHANGE_PLAN_UPGRADED: (name: string) => t('plans.change.upgraded', { name }),
    CHANGE_PLAN_SCHEDULED: (name: string, date: string) => t('plans.change.scheduled', { name, date }),
    CHANGE_PLAN_UNCHANGED: t('plans.change.unchanged'),
    CHANGE_PLAN_ENDING: t('plans.change.ending'),
    CHANGE_PLAN_PAYMENT_FAILED: t('plans.change.paymentFailed'),
    CHANGE_PLAN_PAYMENT_FAILED_PENDING_LOST: t('plans.change.paymentFailedPendingLost'),
    CHANGE_PLAN_UNAVAILABLE: t('plans.change.unavailable'),
    PENDING_CHANGE_LINE: (name: string, date: string) => t('plans.change.pendingChangeLine', { name, date }),
    KEEP_PLAN_BUTTON: (name: string) => t('plans.change.keepPlanButton', { name }),
    CANCEL_WITH_PENDING_NOTE: (name: string, date: string) => t('cancel.withPendingNote', { name, date }),
    CANCEL_PLAN_BUTTON: t('cancel.planButton'),
    CANCEL_IN_APP_LINE: t('cancel.inAppLine'),
    RESUME_FAILED_MESSAGE: t('cancel.resumeFailedMessage', { supportEmail: SUPPORT_EMAIL, supportPhone: SUPPORT_PHONE_DISPLAY }),
    RESUME_BUSY_MESSAGE: t('cancel.resumeBusyMessage'),
    CANCEL_FAILED_MESSAGE: t('cancel.failedMessage', { supportEmail: SUPPORT_EMAIL, supportPhone: SUPPORT_PHONE_DISPLAY }),
    BILLING_PENDING_NOTICE: (name: string, date: string) => t('plans.billing.pendingNotice', { name, date }),
    BILLING_UNAVAILABLE: t('plans.billing.unavailable'),
    BILLING_HEADING: t('plans.billing.heading'),
    UPDATE_CARD_BUTTON: t('plans.billing.updateCardButton'),
    CARD_UPDATED_NOTICE: t('plans.billing.cardUpdatedNotice'),
    INVOICES_HEADING: t('plans.billing.invoicesHeading'),
    INVOICES_EMPTY: t('plans.billing.invoicesEmpty'),
    INVOICE_STATUS_LABEL: {
      paid: t('plans.billing.invoiceStatus.paid'),
      open: t('plans.billing.invoiceStatus.open'),
      uncollectible: t('plans.billing.invoiceStatus.uncollectible'),
    } as const,
    VIEW_INVOICE: t('plans.billing.viewInvoice'),
    INVOICE_PLAN_PART: (amount: string) => t('plans.billing.invoicePlanPart', { amount }),
    INVOICE_TIP_PART: (amount: string) => t('tips.invoiceTipPart', { amount }),
    DOWNLOAD_INVOICE_PDF: t('plans.billing.downloadInvoicePdf'),
    /** PROPOSED for Sable, NOT wired (see errors.plans.alreadyHasPlanMessage, awaiting Sable's fix). */
    ALREADY_HAS_PLAN_SWITCH: t('plans.change.alreadyHasPlanSwitch'),
    CURRENT_PLAN_LINE: (line: string) => t('plans.currentPlanLine', { line }),
    STARTS_ON_BADGE: (date: string) => t('plans.change.startsOnBadge', { date }),
    SEE_COMING_SOON: (count: number) => t('plans.seeComingSoon', { count }),
    CHOOSE_STEP_BUTTON: (name: string) => t('plans.chooseStepButton', { name }),
    CLAIM_CHANGE_PLAN_LINK: t('plans.change.changePlanLink'),
    CHANGE_PLAN_PICK_TO_SWITCH: t('plans.change.pickToSwitch'),
    /** Lina (Oct 13): busy label on the switch button while it submits ('Switching…' / 'Cambiando de plan…', Sable 04:22). */
    CHANGE_PLAN_SWITCHING: t('plans.change.switching'),
    CHANGE_PLAN_BUTTON_NOW: (name: string) => t('plans.change.buttonNow', { name }),
    /** On the button `date` is the short form ("Nov 3") so it fits at 375 (Lina, round 5b). */
    CHANGE_PLAN_BUTTON_ON: (name: string, date: string) => t('plans.change.buttonOn', { name, date }),
    CHANGE_PLAN_HELP_UP: t('plans.change.helpUp'),
    CHANGE_PLAN_HELP_DOWN: t('plans.change.helpDown'),
    UPGRADE_CALCULATING: t('plans.change.calculating'),
    UPGRADE_CONFIRM_LINE: (name: string, today: string, monthly: string, date: string) =>
      t('plans.change.confirmLine', { name, todayAmount: today, monthly, date }),
    UPGRADE_CONFIRM_FALLBACK: (name: string) => t('plans.change.confirmFallback', { name }),
    UPGRADE_CONFIRM_BUTTON: t('plans.change.confirmButton'),
    UPGRADE_CANCEL_BUTTON: t('plans.change.cancelButton'),
    UPGRADE_PREVIEW_EXPIRED: t('plans.change.previewExpired'),
    UPGRADE_IN_PROGRESS: t('plans.change.inProgress'),
    CHANGE_PLAN_LINK: t('plans.change.changePlanLink'),
    CANCEL_OPTIONS_LINK: t('cancel.optionsLink'),
    GRANDFATHERED_HOSTING_ONLY_NAME: t('plans.grandfatheredHostingOnlyName'),
    GRANDFATHERED_HOSTING_SHORT: t('plans.grandfatheredHostingShort'),
    LEGACY_ADDON_NAME: (tierName: string) => t('plans.legacyAddonName', { tier: tierName }),
    /** L-1 unknown grandfathered add-on: "Add-on ($15)" / "Complemento ($15)" (Sable 04:22; named add-ons stay English). */
    GENERIC_ADDON_LABEL: t('plans.genericAddonLabel'),
    GENERIC_ADDON_NAME: (price?: string) => (price ? `${t('plans.genericAddonLabel')} (${price})` : t('plans.genericAddonLabel')),
    HELP_PAYMENT_METHOD: t('help.answers.paymentMethod'),
    UPGRADE_CONFIRM_ZERO: (name: string, monthly: string, date: string) => t('plans.change.confirmZero', { name, monthly, date }),
    UPGRADE_REPLACES_PENDING: (pendingName: string) => t('plans.change.replacesPending', { pendingName }),
    PLAN_CHANGE_TIP_ENDS: (tip: string) => t('tips.planChangeTipEnds', { tip }),
    PLAN_CHANGE_TIP_ENDS_ON: (tip: string, date: string) => t('tips.planChangeTipEndsOn', { tip, date }),
    TIP_SLIDER_LABEL: t('tips.sliderLabel'),
    TIP_SLIDER_HELP: t('tips.sliderHelp'),
    TIP_VALUETEXT: (total: string, tip: string | null) => (tip ? t('tips.valuetext.withTip', { total, tip }) : t('tips.valuetext.noTip', { total })),
    TIP_TOTAL_LINE: (price: string, tip: string | null, total: string) =>
      tip ? t('tips.totalLine.withTip', { price, tip, total }) : t('tips.totalLine.noTip', { total }),
    TIP_SLIDER_HINT: t('tips.sliderHint'),
    TIP_END_NONE: t('tips.endNone'),
    TIP_END_MAX: (max: string) => t('tips.endMax', { max }),
    TIP_LOWER_LABEL: t('tips.lowerLabel'),
    TIP_RAISE_LABEL: t('tips.raiseLabel'),
    TIP_LOCKED_AMOUNT: (tip: string) => t('tips.lockedAmount', { tip }),
    TIP_LOCKED_NOTE: (date: string) => t('tips.lockedNote', { date }),
    TIP_NUDGE: (next: string, price: string, perk: string) => t('tips.nudge', { next, price, perk }),
    TIP_NUDGE_BUTTON: (next: string) => t('tips.nudgeButton', { next }),
    TIP_NUDGE_PERK: Object.fromEntries(PERKS.map((p) => [p, t(`tips.nudgePerk.${p}`)])) as Record<PlanPerk, string>,
    PLAN_STRIP_TIP: (tip: string) => t('tips.planStripTip', { tip }),
    TIP_CHANGE_HEADING: t('tips.changeHeading'),
    TIP_CHANGE_NOTE: t('tips.changeNote'),
    TIP_CHANGE_BUTTON: t('tips.changeButton'),
    TIP_NEXT_BILL: (amount: string, date: string) => t('tips.nextBill', { amount, date }),
    TIP_NEXT_BILL_NO_DATE: (amount: string) => t('tips.nextBillNoDate', { amount }),
    TIP_CHANGED: (nextBill: string) => t('tips.changed', { nextBill }),
    TIP_CHANGE_PENDING: t('tips.changePending'),
    TIP_CHANGE_ENDING: t('tips.changeEnding'),
    TIP_NOT_FOR_PLAN: t('tips.notForPlan'),
    TIP_OUT_OF_RANGE: t('tips.outOfRange'),
    TIP_CHANGE_UNAVAILABLE: t('tips.changeUnavailable'),
    TIP_IN_PROGRESS: t('tips.inProgress'),
    ADDONS_HEADING: t('addons.heading'),
    ADDONS_STARTER_CAP_NOTE: t('addons.starterCapNote', { amount: dollars(ADDON_STEP_LIMITS.starter?.maxAddonCents ?? 0) }),
    ADDON_NAMES,
    addonPerkLine: (id: AddonId | 'visitor_snapshot', opts: { withIncludedEdit?: boolean } = {}): string => {
      if (id === 'small_edit') return opts.withIncludedEdit ? t('addons.perk.smallEditWithIncluded') : t('addons.perk.smallEdit')
      if (id === 'big_change') return t('addons.perk.bigChange')
      return t('addons.perk.visitorSnapshot')
    },
    /**
     * Sable 04:29: {total} = today's charge, {price} = the monthly price. The card has no preview, so the
     * total defaults to the full price (the most it can charge); pass the prorated total when known.
     */
    /** Oct 18 (Cheke): replaces the old Starter "+1 small edit" add-on line (edit pack, edits-copy.ts). */
    starterSmallEditAddonLine: (): string =>
      locale === 'es' ? (editPackFor('starter') > 0 ? EDITS_COPY_ES.needMoreEdits(editPackFor('starter')) : '') : (needMoreEditsLine('starter') ?? ''),
    addonPriceLine: (cents: number) => t('common.amountPerMonth', { amount: dollars(cents) }),
    addonTipDropQuestion: (tipDollars: number, name: string) => t('addons.tipDropQuestionCheckout', { tip: wholeDollars(tipDollars), name }),
    ADDON_TURN_ON: t('addons.turnOn'),
    tipAmountLine: (tipDollars: number) => (tipDollars > 0 ? t('addons.tipAmount', { tip: wholeDollars(tipDollars) }) : t('tips.endNone')),
    ADDON_CANCEL: t('addons.cancel'),
    addonTurnOnQuestion: (name: string) => t('addons.turnOnQuestion', { name }),
    addonChargeNowLine: (amountDueCents: number) => t('addons.chargeToday', { amount: dollars(amountDueCents) }),
    addonChargeAfterCreditLine: (amountDueCents: number) => t('addons.chargeAfterCredit', { amount: dollars(amountDueCents) }),
    ADDON_CREDIT_COVERS: t('addons.creditCovers'),
    addonThenLine: (nextCents: number, date: string | null) =>
      date ? t('addons.thenMonthly', { price: dollars(nextCents), date }) : t('addons.thenMonthlyNoDate', { price: dollars(nextCents) }),
    addonChargeUpToLine: (priceCents: number) => t('addons.chargeUpTo', { price: dollars(priceCents) }),
    addonTipGoesDownQuestion: (tipDollars: number, date: string | null, name: string) =>
      date
        ? t('addons.tipGoesDownQuestion', { tip: wholeDollars(tipDollars), date, name })
        : t('addons.tipGoesDownQuestionNoDate', { tip: wholeDollars(tipDollars), name }),
    addonOffQuestion: (name: string, date: string | null) =>
      date ? t('addons.turnOffQuestion', { name, date }) : t('addons.turnOffQuestionNoDate', { name }),
    ADDON_TURN_OFF: t('addons.turnOff'),
    addonEndsLine: (date: string | null) => (date ? t('addons.endsBadge', { date }) : t('addons.endsBadgeNoDate')),
    ADDON_KEEP: t('addons.keep'),
    addonOnDone: (name: string) => t('addons.doneOn', { name }),
    addonOffDone: (name: string, date: string | null) => (date ? t('addons.doneOff', { name, date }) : t('addons.doneOffNoDate', { name })),
    addonKeepDone: (name: string) => t('addons.doneKeep', { name }),
    addonsLockedBySwitch,
    ADDONS_LOCKED_BY_REMOVAL,
    ADDONS_LEGACY_NOTE: t('addons.legacyNote'),
    ADDON_ERROR: t('addons.error'),
    addonPaymentFailed: (name: string) => t('addons.paymentFailed', { name }),
    addonFinishing: (name: string) => t('addons.finishing', { name }),
    addonRefundFailed: (name: string) => t('addons.refundFailed', { name }),
    ADDON_TURN_OFF_FIRST: t('addons.turnOffFirst'),
    ADDON_PENDING_SWITCH: addonsLockedBySwitch(null),
    ADDON_PENDING_REMOVAL: ADDONS_LOCKED_BY_REMOVAL,
    GO_TO_PLANS: t('help.chat.goToPlans'),
    /** One whole sentence; the names are an Intl list (Aria, Oct 4: no ", " joins in copy). */
    addonsStayOnLine: (names: readonly string[] | string) => t('addons.stayOnLine', { names: formatList(([] as string[]).concat(names), locale) }),
    addonsPendingEndLine: (names: readonly string[] | string, date: string) => {
      const list = ([] as string[]).concat(names)
      return t('addons.pendingEndLine', { names: formatList(list, locale), count: list.length, date })
    },
    /** One total (action area / sticky bar): "Starter $35 · Add-ons $10.75 · Tip $4". */
    planTotalBreakdown: (stepName: string, stepCents: number, addonCents: number, tipCents: number): string => {
      const parts = [t('plans.totalBreakdown.plan', { plan: stepName, amount: dollars(stepCents) })]
      if (addonCents > 0) parts.push(t('plans.totalBreakdown.addons', { amount: dollars(addonCents) }))
      if (tipCents > 0) parts.push(t('plans.totalBreakdown.tip', { amount: dollars(tipCents) }))
      return parts.join(' · ')
    },
    planTotalLine: (totalCents: number) => t('common.amountPerMonth', { amount: dollars(totalCents) }),
    /** "$65.00/month" for an already formatted amount. */
    AMOUNT_PER_MONTH: (amount: string) => t('common.amountPerMonth', { amount }),
    planStripAddons: (cents: number) => t('addons.planStripAddons', { amount: dollars(cents) }),
    ADDON_TOTAL_LINE: (plan: string, addons: string, tip: string | null, total: string) =>
      tip ? t('cancel.addonTotalLine.withTip', { plan, addons, tip, total }) : t('cancel.addonTotalLine.noTip', { plan, addons, total }),
    // ---- Base (ladder-fix-2026-10-03, f5a0f2a) additions, in the catalog since i18n-es-base (Sable's
    // Spanish, /workspace/copy/freeplug-ladder-es-2026-10-13.md).
    /** Aria 10:09 (option A): Resume worked but the dropped add-on removal couldn't be put back (amber box). */
    RESUME_REMOVAL_OWED_STATUS: (name: string) => t('cancel.resumeRemovalOwedStatus', { name }),
    /** The ONE renewal line builder (Plans tip box, its saved notice, the dashboard reminder; Sable 3:15 PM). */
    renewalLineText: (totalCents: number, dateText: string | null) =>
      dateText ? t('tips.nextBill', { amount: dollars(totalCents), date: dateText }) : t('tips.nextBillNoDate', { amount: dollars(totalCents) }),
    /** [Final, Sable Oct 4 ~2:43 PM CT] Gray line under the renewal line while a carried small amount is unbilled. */
    renewalCarriedLine: (carriedCents: number) => t('tips.renewalCarriedLine', { amount: dollars(carriedCents) }),
    /** Aria, Oct 4 9:27: under Stripe's $0.50 minimum it goes on the next monthly bill. */
    addonAddedToNextBill: (cents: number) => t('addons.addedToNextBill', { amount: dollars(cents) }),
    /** [Sable + Lina, M-1 (Aria a)] bold "{total} today" / "{total} hoy" (Sable 10-13). */
    addonTodayTotal: (totalCents: number) => t('addons.todayTotal', { total: dollars(totalCents) }),
    addonCarriedBreakdown: (priceCents: number, carriedCents: number) => t('addons.carriedBreakdown', { price: cents2(priceCents), carried: cents2(carriedCents) }),
    /** Aria 9:27: the charge total isn't exactly the add-on price: refused. */
    ADDON_PRICE_UNCONFIRMED: t('addons.priceUnconfirmed'),
    addonRefundSplitLine,
    addonRefunded: (name: string, cardCents: number, creditCents: number) =>
      t('addons.refunded', { name, splitLine: addonRefundSplitLine(cardCents, creditCents), delay: cardRefundDelay(cardCents) }),
    ADDON_REFUND_REASONS,
    /** Plans page note and the email line: the reason, then where the money went. */
    addonRefundNote: (name: string, reason: AddonRefundReason, cardCents: number, creditCents: number, carriedCents: number = 0) =>
      `${ADDON_REFUND_REASONS[isAddonRefundReason(reason) ? reason : 'not_added'](name)} ${addonRefundSplitLine(cardCents, creditCents, carriedCents)}${cardRefundDelay(cardCents)}`,
    /** Several add-ons in one line, an Intl list: "+1 small edit and Big change" / "+1 small edit y Big change". */
    addonNameList: (ids: readonly AddonId[] | AddonId) => formatList(([] as AddonId[]).concat(ids).map((id) => ADDON_NAMES[id] ?? id), locale),
    addonRefundEmailSubject: (name: string) => t('addons.refundEmailSubject', { name }),
    /** Sable, Oct 4 10:01: the subject of the L-1 self-heal refund email ONLY. */
    addonTurnedOffRefundEmailSubject: (name: string) => t('addons.turnedOffRefundEmailSubject', { name }),
    ADDON_REFUND_EMAIL_HELP: t('addons.refundEmailHelp'),
  }
}

/** Sable's gloss keys (plans.gloss.*) per ladder step id. */
const PLAN_GLOSS_KEY: Record<PlanStepId, string> = {
  starter: 'starter',
  priority: 'priority',
  fast_lane: 'fastLane',
  leads: 'leads',
  get_found: 'getFound',
  growth: 'growthPartner',
}

export type LadderCopy = ReturnType<typeof build>
const byLocale = new Map<AppLocale, LadderCopy>()

/** The ladder copy in one language (English for anything unknown). */
export function ladderCopy(locale: AppLocale = DEFAULT_LOCALE, resolved?: Messages): LadderCopy {
  // Client components pass the provider's messages: the server already decided what is servable
  // (gate, draft status, FREEPLUG_I18N_ES_ALLOW_PENDING), so the browser never re-decides it.
  if (resolved && typeof resolved === 'object' && isAppLocale(locale)) return build(translatorFromMessages(locale, resolved), locale)
  const hit = byLocale.get(locale)
  if (hit) return hit
  const copy = build(translatorFor(locale), locale)
  if (!process.env.VITEST) byLocale.set(locale, copy)
  return copy
}


// ---------------------------------------------------------------- English exports (en.json)
const EN = build(translatorFor('en'), 'en')
export const NEXT_BUSINESS_DAY_TARGET = EN.NEXT_BUSINESS_DAY_TARGET
export const STEP_BLURBS = EN.STEP_BLURBS
export const PERK_LINES = EN.PERK_LINES
export const STARTER_BASE_LINES = EN.STARTER_BASE_LINES
export const LADDER_HEADING = EN.LADDER_HEADING
export const LADDER_SUBHEADING = EN.LADDER_SUBHEADING
export const MOST_POPULAR_LABEL = EN.MOST_POPULAR_LABEL
export const EVERYTHING_IN = EN.EVERYTHING_IN
export const PER_MONTH = EN.PER_MONTH
export const CONTINUE_TO_PAYMENT = EN.CONTINUE_TO_PAYMENT
export const LEGACY_PLAN_NOTE = EN.LEGACY_PLAN_NOTE
export const LEGACY_PLAN_LABEL = EN.LEGACY_PLAN_LABEL
export const INCLUDED_EDIT_LINE = EN.INCLUDED_EDIT_LINE
export const NEXT_BUSINESS_DAY_LINE = EN.NEXT_BUSINESS_DAY_LINE
export const aiEditsLine = EN.aiEditsLine
export const LANDING_PLANS_INTRO = EN.LANDING_PLANS_INTRO
export const DASHBOARD_PLANS_INTRO = EN.DASHBOARD_PLANS_INTRO
export const CLAIM_STEP3_BODY = EN.CLAIM_STEP3_BODY
export const HELP_WHAT_DO_I_PAY = EN.HELP_WHAT_DO_I_PAY
export const HELP_HOSTING_PLANS = EN.HELP_HOSTING_PLANS
export const HELP_REQUEST_CHANGES = EN.HELP_REQUEST_CHANGES
export const HELP_HIDDEN_FEES = EN.HELP_HIDDEN_FEES
export const HELP_SECURITY = EN.HELP_SECURITY
export const HELP_PLANS_GUIDE_TITLE_LINE = EN.HELP_PLANS_GUIDE_TITLE_LINE
export const HELP_PLANS_GUIDE_DESCRIPTION = EN.HELP_PLANS_GUIDE_DESCRIPTION
export const HELP_CHAT_INCLUDED_EDIT_NOTE = EN.HELP_CHAT_INCLUDED_EDIT_NOTE
export const COMING_SOON_LABEL = EN.COMING_SOON_LABEL
export const STEP_NOT_SELLABLE_MESSAGE = EN.STEP_NOT_SELLABLE_MESSAGE
export const CHANGE_PLAN_BUTTON = EN.CHANGE_PLAN_BUTTON
export const CHANGE_PLAN_CURRENT = EN.CHANGE_PLAN_CURRENT
export const CHANGE_PLAN_HELP = EN.CHANGE_PLAN_HELP
export const CHANGE_PLAN_UPGRADED = EN.CHANGE_PLAN_UPGRADED
export const CHANGE_PLAN_SCHEDULED = EN.CHANGE_PLAN_SCHEDULED
export const CHANGE_PLAN_UNCHANGED = EN.CHANGE_PLAN_UNCHANGED
export const CHANGE_PLAN_ENDING = EN.CHANGE_PLAN_ENDING
export const CHANGE_PLAN_PAYMENT_FAILED = EN.CHANGE_PLAN_PAYMENT_FAILED
export const CHANGE_PLAN_PAYMENT_FAILED_PENDING_LOST = EN.CHANGE_PLAN_PAYMENT_FAILED_PENDING_LOST
export const CHANGE_PLAN_UNAVAILABLE = EN.CHANGE_PLAN_UNAVAILABLE
export const PENDING_CHANGE_LINE = EN.PENDING_CHANGE_LINE
export const KEEP_PLAN_BUTTON = EN.KEEP_PLAN_BUTTON
export const CANCEL_WITH_PENDING_NOTE = EN.CANCEL_WITH_PENDING_NOTE
export const CANCEL_PLAN_BUTTON = EN.CANCEL_PLAN_BUTTON
export const CANCEL_IN_APP_LINE = EN.CANCEL_IN_APP_LINE
export const RESUME_FAILED_MESSAGE = EN.RESUME_FAILED_MESSAGE
export const RESUME_BUSY_MESSAGE = EN.RESUME_BUSY_MESSAGE
export const CANCEL_FAILED_MESSAGE = EN.CANCEL_FAILED_MESSAGE
export const BILLING_PENDING_NOTICE = EN.BILLING_PENDING_NOTICE
export const BILLING_UNAVAILABLE = EN.BILLING_UNAVAILABLE
export const BILLING_HEADING = EN.BILLING_HEADING
export const UPDATE_CARD_BUTTON = EN.UPDATE_CARD_BUTTON
export const CARD_UPDATED_NOTICE = EN.CARD_UPDATED_NOTICE
export const INVOICES_HEADING = EN.INVOICES_HEADING
export const INVOICES_EMPTY = EN.INVOICES_EMPTY
export const INVOICE_STATUS_LABEL = EN.INVOICE_STATUS_LABEL
export const VIEW_INVOICE = EN.VIEW_INVOICE
export const INVOICE_PLAN_PART = EN.INVOICE_PLAN_PART
export const INVOICE_TIP_PART = EN.INVOICE_TIP_PART
export const DOWNLOAD_INVOICE_PDF = EN.DOWNLOAD_INVOICE_PDF
export const ALREADY_HAS_PLAN_SWITCH = EN.ALREADY_HAS_PLAN_SWITCH
export const CURRENT_PLAN_LINE = EN.CURRENT_PLAN_LINE
export const STARTS_ON_BADGE = EN.STARTS_ON_BADGE
export const SEE_COMING_SOON = EN.SEE_COMING_SOON
export const CHOOSE_STEP_BUTTON = EN.CHOOSE_STEP_BUTTON
export const CLAIM_CHANGE_PLAN_LINK = EN.CLAIM_CHANGE_PLAN_LINK
export const CHANGE_PLAN_PICK_TO_SWITCH = EN.CHANGE_PLAN_PICK_TO_SWITCH
export const CHANGE_PLAN_SWITCHING = EN.CHANGE_PLAN_SWITCHING
export const CHANGE_PLAN_BUTTON_NOW = EN.CHANGE_PLAN_BUTTON_NOW
export const CHANGE_PLAN_BUTTON_ON = EN.CHANGE_PLAN_BUTTON_ON
export const CHANGE_PLAN_HELP_UP = EN.CHANGE_PLAN_HELP_UP
export const CHANGE_PLAN_HELP_DOWN = EN.CHANGE_PLAN_HELP_DOWN
export const UPGRADE_CALCULATING = EN.UPGRADE_CALCULATING
export const UPGRADE_CONFIRM_LINE = EN.UPGRADE_CONFIRM_LINE
export const UPGRADE_CONFIRM_FALLBACK = EN.UPGRADE_CONFIRM_FALLBACK
export const UPGRADE_CONFIRM_BUTTON = EN.UPGRADE_CONFIRM_BUTTON
export const UPGRADE_CANCEL_BUTTON = EN.UPGRADE_CANCEL_BUTTON
export const UPGRADE_PREVIEW_EXPIRED = EN.UPGRADE_PREVIEW_EXPIRED
export const UPGRADE_IN_PROGRESS = EN.UPGRADE_IN_PROGRESS
export const CHANGE_PLAN_LINK = EN.CHANGE_PLAN_LINK
export const CANCEL_OPTIONS_LINK = EN.CANCEL_OPTIONS_LINK
export const GRANDFATHERED_HOSTING_ONLY_NAME = EN.GRANDFATHERED_HOSTING_ONLY_NAME
export const GRANDFATHERED_HOSTING_SHORT = EN.GRANDFATHERED_HOSTING_SHORT
export const LEGACY_ADDON_NAME = EN.LEGACY_ADDON_NAME
export const GENERIC_ADDON_LABEL = EN.GENERIC_ADDON_LABEL
export const GENERIC_ADDON_NAME = EN.GENERIC_ADDON_NAME
export const HELP_PAYMENT_METHOD = EN.HELP_PAYMENT_METHOD
export const UPGRADE_CONFIRM_ZERO = EN.UPGRADE_CONFIRM_ZERO
export const UPGRADE_REPLACES_PENDING = EN.UPGRADE_REPLACES_PENDING
export const PLAN_CHANGE_TIP_ENDS = EN.PLAN_CHANGE_TIP_ENDS
export const PLAN_CHANGE_TIP_ENDS_ON = EN.PLAN_CHANGE_TIP_ENDS_ON
export const TIP_SLIDER_LABEL = EN.TIP_SLIDER_LABEL
export const TIP_SLIDER_HELP = EN.TIP_SLIDER_HELP
export const TIP_VALUETEXT = EN.TIP_VALUETEXT
export const TIP_TOTAL_LINE = EN.TIP_TOTAL_LINE
export const TIP_SLIDER_HINT = EN.TIP_SLIDER_HINT
export const TIP_END_NONE = EN.TIP_END_NONE
export const TIP_END_MAX = EN.TIP_END_MAX
export const TIP_LOWER_LABEL = EN.TIP_LOWER_LABEL
export const TIP_RAISE_LABEL = EN.TIP_RAISE_LABEL
export const TIP_LOCKED_AMOUNT = EN.TIP_LOCKED_AMOUNT
export const TIP_LOCKED_NOTE = EN.TIP_LOCKED_NOTE
export const TIP_NUDGE = EN.TIP_NUDGE
export const TIP_NUDGE_BUTTON = EN.TIP_NUDGE_BUTTON
export const TIP_NUDGE_PERK = EN.TIP_NUDGE_PERK
export const PLAN_STRIP_TIP = EN.PLAN_STRIP_TIP
export const TIP_CHANGE_HEADING = EN.TIP_CHANGE_HEADING
export const TIP_CHANGE_NOTE = EN.TIP_CHANGE_NOTE
export const TIP_CHANGE_BUTTON = EN.TIP_CHANGE_BUTTON
export const TIP_NEXT_BILL = EN.TIP_NEXT_BILL
export const TIP_NEXT_BILL_NO_DATE = EN.TIP_NEXT_BILL_NO_DATE
export const TIP_CHANGED = EN.TIP_CHANGED
export const TIP_CHANGE_PENDING = EN.TIP_CHANGE_PENDING
export const TIP_CHANGE_ENDING = EN.TIP_CHANGE_ENDING
export const TIP_NOT_FOR_PLAN = EN.TIP_NOT_FOR_PLAN
export const TIP_OUT_OF_RANGE = EN.TIP_OUT_OF_RANGE
export const TIP_CHANGE_UNAVAILABLE = EN.TIP_CHANGE_UNAVAILABLE
export const TIP_IN_PROGRESS = EN.TIP_IN_PROGRESS
export const ADDONS_HEADING = EN.ADDONS_HEADING
export const ADDONS_STARTER_CAP_NOTE = EN.ADDONS_STARTER_CAP_NOTE
export const ADDON_NAMES = EN.ADDON_NAMES
export const addonPerkLine = EN.addonPerkLine
export const starterSmallEditAddonLine = EN.starterSmallEditAddonLine
export const addonPriceLine = EN.addonPriceLine
export const addonTipDropQuestion = EN.addonTipDropQuestion
export const ADDON_TURN_ON = EN.ADDON_TURN_ON
export const tipAmountLine = EN.tipAmountLine
export const ADDON_CANCEL = EN.ADDON_CANCEL
export const addonTurnOnQuestion = EN.addonTurnOnQuestion
export const addonChargeNowLine = EN.addonChargeNowLine
export const addonChargeAfterCreditLine = EN.addonChargeAfterCreditLine
export const ADDON_CREDIT_COVERS = EN.ADDON_CREDIT_COVERS
export const addonThenLine = EN.addonThenLine
export const addonChargeUpToLine = EN.addonChargeUpToLine
export const addonTipGoesDownQuestion = EN.addonTipGoesDownQuestion
export const addonOffQuestion = EN.addonOffQuestion
export const ADDON_TURN_OFF = EN.ADDON_TURN_OFF
export const addonEndsLine = EN.addonEndsLine
export const ADDON_KEEP = EN.ADDON_KEEP
export const addonOnDone = EN.addonOnDone
export const addonOffDone = EN.addonOffDone
export const addonKeepDone = EN.addonKeepDone
export const addonsLockedBySwitch = EN.addonsLockedBySwitch
export const ADDONS_LOCKED_BY_REMOVAL = EN.ADDONS_LOCKED_BY_REMOVAL
export const ADDONS_LEGACY_NOTE = EN.ADDONS_LEGACY_NOTE
export const ADDON_ERROR = EN.ADDON_ERROR
export const addonPaymentFailed = EN.addonPaymentFailed
export const addonFinishing = EN.addonFinishing
export const addonRefundFailed = EN.addonRefundFailed
export const ADDON_TURN_OFF_FIRST = EN.ADDON_TURN_OFF_FIRST
export const ADDON_PENDING_SWITCH = EN.ADDON_PENDING_SWITCH
export const ADDON_PENDING_REMOVAL = EN.ADDON_PENDING_REMOVAL
export const GO_TO_PLANS = EN.GO_TO_PLANS
export const addonsStayOnLine = EN.addonsStayOnLine
export const addonsPendingEndLine = EN.addonsPendingEndLine
export const planTotalBreakdown = EN.planTotalBreakdown
export const planTotalLine = EN.planTotalLine
export const AMOUNT_PER_MONTH = EN.AMOUNT_PER_MONTH
export const planStripAddons = EN.planStripAddons
export const ADDON_TOTAL_LINE = EN.ADDON_TOTAL_LINE
// Base (ladder-fix) additions.
export const RESUME_REMOVAL_OWED_STATUS = EN.RESUME_REMOVAL_OWED_STATUS
export const renewalLineText = EN.renewalLineText
export const renewalCarriedLine = EN.renewalCarriedLine
export const addonAddedToNextBill = EN.addonAddedToNextBill
export const addonTodayTotal = EN.addonTodayTotal
export const addonCarriedBreakdown = EN.addonCarriedBreakdown
export const ADDON_PRICE_UNCONFIRMED = EN.ADDON_PRICE_UNCONFIRMED
export const addonRefundSplitLine = EN.addonRefundSplitLine
export const addonRefunded = EN.addonRefunded
export const ADDON_REFUND_REASONS = EN.ADDON_REFUND_REASONS
export const addonRefundNote = EN.addonRefundNote
export const addonNameList = EN.addonNameList
export const addonRefundEmailSubject = EN.addonRefundEmailSubject
export const addonTurnedOffRefundEmailSubject = EN.addonTurnedOffRefundEmailSubject
export const ADDON_REFUND_EMAIL_HELP = EN.ADDON_REFUND_EMAIL_HELP
