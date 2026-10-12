'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { RemovalOwedBox } from './RemovalOwedBox'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useTranslations } from 'next-intl'
import { openBillingPortal } from '@/app/(dashboard)/dashboard/billing-actions'
import type {
  AddonPreviewResponse,
  ChangeAddonResponse,
  ChangeHostingPlanResult,
  ChangeTipResponse,
  PlanPreviewResponse,
  TipPreviewResponse,
} from '@/app/(dashboard)/dashboard/billing-actions'
import { TipSlider, tipTotalText } from './TipSlider'
import { TipChangeBox } from './TipChangeBox'
import { AddonsBlock, type ConfirmTotals } from './AddonsBlock'
import { PLAN_STEPS, type AddonId, type PlanStep, type PlanStepId } from '@/lib/plans/ladder'
import { addonConfigCents } from '@/lib/plans/addons'
import { tipRangeFor } from '@/lib/plans/tips'
import { PRORATION_DATE_MAX_AGE_SECONDS, planMove, type PlanMove } from '@/lib/plans/plan-direction'
import { MOST_POPULAR_STEP } from '@/lib/plans/ladder-copy'
import { useLadderCopy } from '@/lib/plans/use-ladder-copy'

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}
/** The amount charged today always shows cents ("$12.34", "$0.00"). */
function formatCharge(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const LOGIN_THEN_REQUEST = `/login?next=${encodeURIComponent('/dashboard/request-website')}`

/** The confirm closes this long after the preview arrived, before the server's 10-minute limit. */
export const CONFIRM_OPEN_MS = (PRORATION_DATE_MAX_AGE_SECONDS - 30) * 1000

/** Phones (< sm): the action area sticks to the bottom of the screen while the card is in view. */
const STICKY_BAR =
  'sticky bottom-0 z-10 -mx-6 border-t border-zinc-200 bg-white px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none'

const COLS: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' }

type Props = {
  /** When false, section uses neutral background (e.g. dashboard). */
  embedded?: boolean
  /** Default true (dashboard). Landing passes actual session. */
  signedIn?: boolean
  /** Requires a submitted website request; enforced on API too. Default true. */
  allowCheckout?: boolean
  /**
   * Lines describing the customer's live plan(s). When non-empty, checkout is replaced by
   * switching (or Manage billing); the API refuses a second plan with 409 too.
   */
  currentPlanLines?: string[]
  /**
   * Choose-plan mode (outreach claim step 3): the button saves the plan through this callback
   * instead of opening Checkout; nothing is charged. Returns an error message or null.
   */
  onChoosePlan?: (plan: { planStep: PlanStepId; tipDollars: number }) => Promise<string | null>
  /** Button label in choose-plan mode. */
  chooseLabel?: string
  /** Button label in choose-plan mode that names the pick (Lina §2: "Choose <Name>"). Wins over chooseLabel. */
  chooseLabelFor?: (name: string) => string
  /** One grey line above the button in choose-plan mode. */
  noteAboveButton?: string
  /** With a live plan: the ladder step it is on (null for a grandfathered plan). */
  currentStepId?: PlanStepId | null
  /** With a live plan: what it costs a month now (direction for a grandfathered plan). */
  currentMonthlyCents?: number | null
  /** With a live plan: the next billing date, formatted ("Switch to X on <date>"). */
  renewalDate?: string | null
  /** Short form of renewalDate for the downgrade button only ("Nov 3"; Lina, round 5b). Falls back to renewalDate. */
  renewalDateShort?: string | null
  /**
   * With a live plan: switch it to the selected step (server action changeHostingPlan). Upgrades
   * now and prorated (after the confirm, with its proration date), downgrades at the next billing date.
   */
  onChangePlan?: (planStep: PlanStepId, prorationDate?: number) => Promise<ChangeHostingPlanResult>
  /** With a live plan: read-only upgrade preview (server action previewPlanChange). */
  onPreviewChange?: (planStep: PlanStepId) => Promise<PlanPreviewResponse>
  /** With a live plan: a downgrade waiting for the next billing date (date already formatted). */
  pendingChange?: { stepId: PlanStepId; date: string } | null
  /** Plans page and landing: the sellable steps as columns from lg (Lina §1). Claim stays stacked. */
  layout?: 'stacked' | 'columns'
  /** Claim step 3: no card shell and no heading; the page card holds them (Lina §2). */
  bare?: boolean
  /** Phones: the action area becomes a sticky bottom bar (claim step 3, Plans page). */
  stickyOnPhone?: boolean
  /** The tipping system: show the optional tip slider before checkout / choose-plan (default true). */
  showTip?: boolean
  /** With a live plan: the current monthly tip in whole dollars (0 = none). */
  currentTipDollars?: number
  /** With a live ladder plan: tip box actions (server actions previewTipChangeAction / changeTipAction). */
  onPreviewTip?: (tipDollars: number) => Promise<TipPreviewResponse>
  onChangeTip?: (tipDollars: number, confirmId?: string) => Promise<ChangeTipResponse>
  /**
   * The add-ons block (Lina's approved spec, Oct 4): under the step list on every step, before the
   * tip. New checkout sends the picks with the plan; a live ladder plan switches them through these
   * server actions. Default true; the claim flow (onChoosePlan) never shows it.
   */
  showAddons?: boolean
  /** With a live plan: the add-ons on it now (including ones set to end). */
  currentAddons?: AddonId[]
  /** With a live plan: add-ons set to end at `endingAddonsDate` (a planned removal). */
  endingAddons?: AddonId[]
  endingAddonsDate?: string | null
  /** Aria 10:09: add-ons a resume left owed (amber box at the top of the card until the removal finishes). */
  removalOwedAddons?: AddonId[]
  /** A second Resume click: scroll to that box and focus it. */
  focusRemovalOwed?: boolean
  onPreviewAddon?: (addonId: AddonId, action: 'on' | 'off') => Promise<AddonPreviewResponse>
  onChangeAddon?: (addonId: AddonId, action: 'on' | 'off' | 'keep', opts?: { prorationDate?: number; tipDropTo?: number }) => Promise<ChangeAddonResponse>
}

/** Upgrade confirm states (Lina §3a). Downgrades and checkout never enter it. */
type ConfirmState =
  | { phase: 'idle'; expired: boolean }
  | { phase: 'loading'; step: PlanStepId }
  | { phase: 'confirm' | 'submitting'; step: PlanStepId; text: string; extra: string[]; prorationDate?: number }

export function HostingCheckoutCard({
  embedded = false,
  signedIn = true,
  allowCheckout = true,
  currentPlanLines,
  onChoosePlan,
  chooseLabel,
  chooseLabelFor,
  noteAboveButton,
  currentStepId = null,
  currentMonthlyCents = null,
  renewalDate = null,
  renewalDateShort = null,
  onChangePlan,
  onPreviewChange,
  pendingChange = null,
  layout = 'stacked',
  bare = false,
  stickyOnPhone = false,
  showTip = true,
  currentTipDollars = 0,
  onPreviewTip,
  onChangeTip,
  showAddons = true,
  currentAddons = [],
  endingAddons = [],
  endingAddonsDate = null,
  removalOwedAddons = [],
  focusRemovalOwed = false,
  onPreviewAddon,
  onChangeAddon,
}: Props) {
  const ladder = useLadderCopy()
  const { PLAN_GLOSS, CHANGE_PLAN_BUTTON_NOW, CHANGE_PLAN_BUTTON_ON, CHANGE_PLAN_BUTTON, CHANGE_PLAN_CURRENT, CHANGE_PLAN_HELP_DOWN, CHANGE_PLAN_HELP_UP, CHANGE_PLAN_PICK_TO_SWITCH, COMING_SOON_LABEL, CONTINUE_TO_PAYMENT, CURRENT_PLAN_LINE, KEEP_PLAN_BUTTON, PENDING_CHANGE_LINE, EVERYTHING_IN, LADDER_HEADING, LADDER_SUBHEADING, MOST_POPULAR_LABEL, PER_MONTH, PERK_LINES, SEE_COMING_SOON, STARTS_ON_BADGE, aiEditsLine, STARTER_BASE_LINES, UPGRADE_CALCULATING, UPGRADE_CANCEL_BUTTON, UPGRADE_CONFIRM_BUTTON, UPGRADE_CONFIRM_FALLBACK, UPGRADE_CONFIRM_LINE, UPGRADE_PREVIEW_EXPIRED, UPGRADE_CONFIRM_ZERO, UPGRADE_REPLACES_PENDING, PLAN_CHANGE_TIP_ENDS, PLAN_CHANGE_TIP_ENDS_ON, ADDON_NAMES, addonsStayOnLine, planTotalBreakdown, planTotalLine, addonTodayTotal } = ladder
  const t = useTranslations()
  // sellable=false steps (ladder.ts) show "Coming soon" and can't be picked, except the step a
  // customer is already on. The server refuses them too (checkout, claim, publish, switching).
  const pickable = (id: PlanStepId) => id === currentStepId || PLAN_STEPS.some((s) => s.id === id && s.sellable)
  const [planStep, setPlanStep] = useState<PlanStepId>(
    currentStepId ?? PLAN_STEPS.find((s) => s.sellable)?.id ?? PLAN_STEPS[0].id
  )
  // The tipping system: whole dollars on top of the selected step (0 = no tip). Resets on every pick.
  const [tipDollars, setTipDollars] = useState(0)
  // New checkout: the add-ons picked (they stay through step picks; the server re-checks them).
  const [addonPicks, setAddonPicks] = useState<AddonId[]>([])
  /** Vera M-1: an open add-on confirm with a carried small amount: its "{total} today" (phone bar), else null. */
  const [confirmTotals, setConfirmTotals] = useState<ConfirmTotals | null>(null)
  const [loading, setLoading] = useState(false)
  const [keeping, setKeeping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ phase: 'idle', expired: false })
  const [soonOpen, setSoonOpen] = useState(false)
  const soonId = useId()
  const switchRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stale-request guard for the upgrade preview: every preview takes a number, and closing (Esc, Not
  // now, expiry, unmount) bumps it, so a preview that arrives after that is dropped.
  const previewSeq = useRef(0)

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(
    () => () => {
      clearTimer()
      previewSeq.current++
    },
    []
  )

  const closeConfirm = useCallback((expired: boolean) => {
    clearTimer()
    previewSeq.current++
    setConfirm({ phase: 'idle', expired })
    // Back to the switch button (Lina §3a: Esc and Cancel return focus to it).
    setTimeout(() => switchRef.current?.focus(), 0)
  }, [])

  // Focus moves to Confirm when the confirm appears; Esc closes it, and Esc while "Checking the
  // amount…" cancels the same way (Vera, aaec23d report). A layout effect, so focus and the listener
  // are set in the same commit that inserts Confirm: no gap where an Esc is lost (finding 2).
  useLayoutEffect(() => {
    if (confirm.phase !== 'confirm' && confirm.phase !== 'loading') return
    if (confirm.phase === 'confirm') confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirm.phase, closeConfirm])

  const hasLivePlan = (currentPlanLines?.length ?? 0) > 0
  const canPay = signedIn && allowCheckout && !hasLivePlan
  const canSwitch = hasLivePlan && Boolean(onChangePlan)
  const selectable = canPay || canSwitch
  const stepOf = (id: PlanStepId): PlanStep => PLAN_STEPS.find((s) => s.id === id)!
  const selected = stepOf(planStep)
  const currentStep = currentStepId ? stepOf(currentStepId) : null
  const nowCents = currentMonthlyCents ?? currentStep?.monthlyCents ?? 0
  const direction: PlanMove = planMove(currentStep, nowCents, selected)
  const pendingName = pendingChange ? stepOf(pendingChange.stepId).name : ''
  const tipText = currentTipDollars > 0 ? formatDollars(currentTipDollars * 100) : null
  /** Lines under the upgrade confirm (Sable 2:20 PM): the planned switch it replaces, the tip it ends. */
  const upgradeExtras = [
    ...(pendingChange ? [UPGRADE_REPLACES_PENDING(pendingName)] : []),
    ...(tipText ? [PLAN_CHANGE_TIP_ENDS(tipText)] : []),
  ]

  async function runChange(step: PlanStepId, prorationDate?: number) {
    if (!onChangePlan) return
    setError(null)
    setNotice(null)
    setLoading(true)
    try {
      const r = await onChangePlan(step, prorationDate)
      if (r.code === 'stale_preview') {
        closeConfirm(true)
        return
      }
      if (r.ok) setNotice(r.message)
      else setError(r.message)
      if (confirm.phase !== 'idle') closeConfirm(false)
    } catch {
      setError(t('errors.plans.networkError'))
      clearTimer()
      setConfirm({ phase: 'idle', expired: false })
    } finally {
      setLoading(false)
    }
  }

  async function onSwitch() {
    if (!onChangePlan) return
    if (direction !== 'upgrade' || !onPreviewChange) {
      await runChange(planStep)
      return
    }
    // Upgrade: preview first, charge only on Confirm (Lina §3a). Never a made-up amount.
    const step = planStep
    const name = selected.name
    setError(null)
    setNotice(null)
    clearTimer()
    const seq = ++previewSeq.current
    setConfirm({ phase: 'loading', step })
    let text = UPGRADE_CONFIRM_FALLBACK(name)
    let prorationDate: number | undefined
    let stayOn: AddonId[] = currentAddons
    try {
      const p = await onPreviewChange(step)
      if (p.ok && p.nextDate) {
        // Exactly $0.00 today (credit covers it, or a same-price move): Sable's zero line. A partial
        // credit keeps the normal line with the real amount, no breakdown.
        text =
          p.amountDueCents === 0
            ? UPGRADE_CONFIRM_ZERO(name, formatDollars(p.nextAmountCents), p.nextDate)
            : UPGRADE_CONFIRM_LINE(name, formatCharge(p.amountDueCents), formatDollars(p.nextAmountCents), p.nextDate)
      }
      prorationDate = p.prorationDate ?? undefined
      if (p.ok && p.addons) stayOn = p.addons
    } catch {
      // network: the fallback line, and the server charges at the time of Confirm
    }
    // Esc (or unmount) during the preview: drop the late result, no confirm and no focus move.
    if (seq !== previewSeq.current) return
    // Lina/Aria: one gray line naming the add-ons that stay on (omitted when none).
    const extra = stayOn.length > 0 ? [...upgradeExtras, addonsStayOnLine(stayOn.map((a) => ADDON_NAMES[a]))] : upgradeExtras
    setConfirm({ phase: 'confirm', step, text, extra, prorationDate })
    timer.current = setTimeout(() => closeConfirm(true), CONFIRM_OPEN_MS)
  }

  async function onConfirm() {
    if (confirm.phase !== 'confirm') return
    clearTimer()
    setConfirm({ ...confirm, phase: 'submitting' })
    await runChange(confirm.step, confirm.prorationDate)
  }

  async function keepCurrent() {
    if (!onChangePlan || !currentStepId) return
    setError(null)
    setNotice(null)
    setKeeping(true)
    try {
      const r = await onChangePlan(currentStepId)
      if (r.ok) setNotice(r.message)
      else setError(r.message)
    } catch {
      setError(t('errors.plans.networkError'))
    } finally {
      setKeeping(false)
    }
  }

  function pick(id: PlanStepId) {
    // Ignored while Confirm is charging (Jace; Vera, 5282e5e report): the checked radio stays on the
    // plan being charged, so the success line matches it. The radios look the same (no disabled);
    // React puts a controlled radio back when its change isn't applied.
    if (confirm.phase === 'submitting') return
    setPlanStep(id)
    // The slider starts at the new step's price (no tip) after every pick.
    setTipDollars(0)
    // A new pick closes an open confirm (its amount was for the old pick), and cancels a preview still
    // loading for the old pick: the counter bump drops its late answer, so no confirm opens for the
    // old plan (Vera, d0624bb report finding 1). Like closeConfirm, minus the focus move: a pick
    // keeps focus on the radio. The radios stay enabled while loading (a visible change; Lina's call).
    if (confirm.phase === 'confirm' || confirm.phase === 'loading') {
      clearTimer()
      previewSeq.current++
      setConfirm({ phase: 'idle', expired: false })
    } else if (confirm.phase === 'idle' && confirm.expired) setConfirm({ phase: 'idle', expired: false })
  }

  async function startHostingCheckout() {
    setError(null)
    setLoading(true)
    if (onChoosePlan) {
      try {
        const message = await onChoosePlan({ planStep, tipDollars })
        if (message) setError(message)
      } finally {
        setLoading(false)
      }
      return
    }
    try {
      const res = await fetch('/api/checkout/hosting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutAddons && addonPicks.length > 0 ? { planStep, tipDollars, addons: addonPicks } : { planStep, tipDollars }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? t('errors.plans.somethingWentWrong'))
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(t('errors.plans.startHostingCheckout.noCheckoutUrlReturned'))
      }
    } catch {
      setError(t('errors.plans.networkError'))
    } finally {
      setLoading(false)
    }
  }

  // ------------------------------------------------------------------ step rows (Lina §0)
  const indexOf = (id: PlanStepId) => PLAN_STEPS.findIndex((s) => s.id === id)
  const main = PLAN_STEPS.filter((s) => s.sellable)
  const soon = PLAN_STEPS.filter((s) => !s.sellable)
  const soonHasCurrent = soon.some((s) => s.id === currentStepId)
  const columns = layout === 'columns'

  function linesFor(step: PlanStep): string[] {
    const aiLine = aiEditsLine(step) // null while showAiEditQuota (ladder.ts) is false
    const i = indexOf(step.id)
    return [...(i === 0 ? STARTER_BASE_LINES : step.adds.map((perk) => PERK_LINES[perk])), ...(aiLine ? [aiLine] : [])]
  }

  function price(step: PlanStep, muted?: boolean) {
    return (
      <span className="shrink-0 whitespace-nowrap">
        <span className={cn('font-bold', muted ? 'text-gray-600' : 'text-gray-900')}>{formatDollars(step.monthlyCents)}</span>
        <span className={cn('text-xs', muted ? 'text-gray-600' : 'text-gray-500')}>{PER_MONTH}</span>
      </span>
    )
  }

  function badgesFor(step: PlanStep) {
    const badges: React.ReactNode[] = []
    if (canSwitch && currentStepId === step.id) {
      badges.push(
        <span key="cur" className="rounded bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-700" data-testid="current-step">
          {CHANGE_PLAN_CURRENT}
        </span>
      )
    }
    if (canSwitch && pendingChange?.stepId === step.id) {
      badges.push(
        <span key="starts" className="rounded bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-700" data-testid="starts-badge">
          {STARTS_ON_BADGE(pendingChange.date)}
        </span>
      )
    }
    if (!step.sellable) {
      badges.push(
        <span key="soon" className="rounded bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800" data-testid="coming-soon">
          {COMING_SOON_LABEL}
        </span>
      )
    }
    if (MOST_POPULAR_STEP === step.id && step.sellable) {
      badges.push(
        <span key="pop" className="rounded bg-[#ba3d3d]/10 px-1.5 text-[11px] font-semibold text-[#ba3d3d]">
          {MOST_POPULAR_LABEL}
        </span>
      )
    }
    return badges.length ? <span className="mt-1 flex flex-wrap gap-1.5">{badges}</span> : null
  }

  function body(step: PlanStep, muted?: boolean) {
    const i = indexOf(step.id)
    return (
      <>
        {i > 0 ? <span className={cn('mt-2 block text-sm', muted ? 'text-gray-600' : 'text-gray-500')}>{EVERYTHING_IN(PLAN_STEPS[i - 1].name)}</span> : null}
        <ul className={cn('list-disc pl-4 text-sm text-gray-600', i > 0 ? 'mt-1' : 'mt-2')}>
          {linesFor(step).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </>
    )
  }

  /** A pickable row: the whole row is the label (tap target, min 44px, p-4). */
  function pickRow(step: PlanStep, compact?: boolean) {
    const isSelected = planStep === step.id
    const canPick = selectable && pickable(step.id)
    return (
      <label
        key={step.id}
        data-plan-step={step.id}
        data-sellable={step.sellable ? 'true' : 'false'}
        data-selected={isSelected ? 'true' : 'false'}
        className={cn(
          'flex min-h-[44px] items-start gap-3 rounded-lg border p-4',
          columns && !compact ? 'h-full' : '',
          isSelected ? 'border-[#ba3d3d] ring-1 ring-[#ba3d3d] bg-[#ba3d3d]/5' : 'border-gray-200 bg-white',
          canPick ? 'cursor-pointer' : 'cursor-default'
        )}
      >
        <input
          type="radio"
          name="plan-step"
          value={step.id}
          checked={isSelected}
          disabled={!pickable(step.id)}
          onChange={() => pick(step.id)}
          className="mt-1 shrink-0 accent-[#ba3d3d] text-[#ba3d3d] focus:ring-[#ba3d3d]"
        />
        <span className="block min-w-0 flex-1 text-sm text-gray-700">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-semibold text-gray-900">{step.name}</span>
            {price(step)}
          </span>
          {gloss(step.id)}
          {badgesFor(step)}
          {body(step)}
        </span>
      </label>
    )
  }

  /** Spanish only: one-line gloss under the English plan name (Aria ruling 2, Sable §3). */
  function gloss(id: PlanStepId) {
    const line = PLAN_GLOSS[id]
    return line ? (
      <span className="block text-xs text-gray-600" data-testid="plan-gloss">
        {line}
      </span>
    ) : null
  }

  /** Coming soon (Lina §0): no radio, not clickable, no hover, grey text (no opacity). */
  function soonRow(step: PlanStep) {
    return (
      <div
        key={step.id}
        data-plan-step={step.id}
        data-sellable="false"
        className={cn('rounded-lg border border-gray-200 bg-zinc-50/60 p-4 text-sm text-gray-600', columns ? 'h-full lg:p-3' : '')}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-gray-600">{step.name}</span>
          {price(step, true)}
        </span>
        {gloss(step.id)}
        {badgesFor(step)}
        {body(step, true)}
      </div>
    )
  }

  const shell = bare
    ? ''
    : embedded
      ? 'rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-zinc-200/80'
      : 'rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-zinc-200/80'

  // ------------------------------------------------------------------ action area
  const switchLabel =
    direction === 'same'
      ? CHANGE_PLAN_PICK_TO_SWITCH
      : direction === 'upgrade'
        ? CHANGE_PLAN_BUTTON_NOW(selected.name)
        : renewalDate
          ? CHANGE_PLAN_BUTTON_ON(selected.name, renewalDateShort ?? renewalDate)
          : CHANGE_PLAN_BUTTON(selected.name)
  const switchHelp = direction === 'upgrade' ? CHANGE_PLAN_HELP_UP : direction === 'downgrade' ? CHANGE_PLAN_HELP_DOWN : null
  // Downgrades have no confirm, so the tip line sits under the downgrade button, with the "what
  // happens" line (Lina §3a pattern), and again in the pending box once the switch is planned.
  const downgradeTipLine = direction === 'downgrade' && tipText && renewalDate ? PLAN_CHANGE_TIP_ENDS_ON(tipText, renewalDate) : null
  const switchDisabled = loading || keeping || direction === 'same' || !pickable(selected.id) || confirm.phase !== 'idle'

  const messages = (
    <div className="order-first sm:order-last" data-testid="plan-messages">
      {notice ? (
        <p className="mb-3 text-sm text-green-700 sm:mb-0 sm:mt-4" role="status">
          {notice}
        </p>
      ) : null}
      {error ? <p className="mb-3 text-sm text-red-600 sm:mb-0 sm:mt-4">{error}</p> : null}
    </div>
  )
  const tipping = showTip && canPay
  // ------------------------------------------------------------------ add-ons (Lina, Oct 4)
  const checkoutAddons = showAddons && canPay && !onChoosePlan
  const liveAddons = showAddons && canSwitch && Boolean(onPreviewAddon && onChangeAddon)
  const pickedAddonCents = checkoutAddons ? addonConfigCents(addonPicks) : 0
  const liveAddonCents = addonConfigCents(currentAddons)
  /** The ONE cap rule (tips.ts tipRangeFor): Starter's total counts the add-ons. */
  const maxTipFor = (ids: AddonId[]) => tipRangeFor(selected, undefined, addonConfigCents(ids))?.maxTip ?? null
  const totalParts = checkoutAddons
    ? { addons: pickedAddonCents, tip: tipping ? tipDollars * 100 : 0 }
    : liveAddons
      ? { addons: liveAddonCents, tip: currentStepId === selected.id ? currentTipDollars * 100 : 0 }
      : null
  /** One total only (Lina): "Starter $35 · Add-ons $10.75 · Tip $4", then "$49.75/month" bold. */
  // Lina (Oct 4): while an add-on confirm is open, the after-change totals (the server's monthly; the
  // breakdown's add-ons are what's left of it after the plan and the tip, so the line always adds up).
  const shownParts =
    totalParts && confirmTotals
      ? (() => {
          const tip = confirmTotals.tipCents ?? totalParts.tip
          return { addons: confirmTotals.monthlyCents - selected.monthlyCents - tip, tip }
        })()
      : totalParts
  const totalBlock = totalParts && shownParts ? (
    <div className="mb-3" data-testid="plan-total">
      <p className="text-sm text-gray-600" data-testid="plan-total-breakdown">
        {planTotalBreakdown(selected.name, selected.monthlyCents, shownParts.addons, shownParts.tip)}
      </p>
      <p className="text-base font-bold text-gray-900" data-testid="plan-total-amount" data-totals={confirmTotals ? 'after' : 'current'}>
        {planTotalLine(selected.monthlyCents + shownParts.addons + shownParts.tip)}
      </p>
      {stickyOnPhone && confirmTotals && confirmTotals.todayCents !== null ? (
        // Vera M-1 (Lina): the phone bar shows the same total the open add-on confirm charges today.
        <p className="text-base font-bold text-gray-900 sm:hidden" data-testid="sticky-addon-today">
          {addonTodayTotal(confirmTotals.todayCents)}
        </p>
      ) : null}
    </div>
  ) : null
  const phoneSummary = stickyOnPhone ? (
    <p className="mb-2 text-xs text-gray-600 sm:hidden" data-testid="sticky-summary">
      {selected.name} ·{' '}
      {tipping && tipDollars > 0 ? (
        tipTotalText(selected, tipDollars, ladder)
      ) : (
        <>
          {formatDollars(selected.monthlyCents)}
          {PER_MONTH}
        </>
      )}
    </p>
  ) : null

  const switchArea = (
    // Lina (Oct 4): a direct child of the card's content (no wrapper), so it sticks while the card is on
    // screen and releases once the card scrolls off.
    <div className={cn('mb-3 flex flex-col', stickyOnPhone ? STICKY_BAR : '')} data-testid="switch-area">
      {messages}
      {/* Live region: "Calculating…" and the confirm line are read out (Lina §3a). */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="confirm-live">
        {confirm.phase === 'loading'
          ? UPGRADE_CALCULATING
          : confirm.phase === 'confirm' || confirm.phase === 'submitting'
            ? [confirm.text, ...confirm.extra].join(' ')
            : ''}
      </p>
      {confirm.phase === 'loading' ? (
        <div data-testid="upgrade-calculating">
          {totalBlock ?? phoneSummary}
          <Button className="w-full" size="lg" disabled aria-disabled="true">
            <Loader2 className="mr-2 animate-spin" size={20} aria-hidden="true" />
            {UPGRADE_CALCULATING}
          </Button>
        </div>
      ) : confirm.phase === 'confirm' || confirm.phase === 'submitting' ? (
        <div data-testid="upgrade-confirm">
          <p className="mb-3 text-sm text-gray-900" aria-hidden="true">
            {confirm.text}
          </p>
          {confirm.extra.length > 0 ? (
            <div className="-mt-1 mb-3 space-y-1 text-sm text-gray-600" aria-hidden="true" data-testid="upgrade-confirm-extra">
              {confirm.extra.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
          <Button ref={confirmRef} className="w-full" size="lg" onClick={onConfirm} disabled={confirm.phase === 'submitting'}>
            {confirm.phase === 'submitting' ? <Loader2 className="animate-spin" size={22} aria-label={UPGRADE_CONFIRM_BUTTON} /> : UPGRADE_CONFIRM_BUTTON}
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => closeConfirm(false)} disabled={confirm.phase === 'submitting'}>
            {UPGRADE_CANCEL_BUTTON}
          </Button>
        </div>
      ) : (
        <div>
          {totalBlock ?? phoneSummary}
          <Button ref={switchRef} className="w-full" size="lg" onClick={onSwitch} disabled={switchDisabled}>
            {loading ? <Loader2 className="animate-spin" size={22} /> : switchLabel}
          </Button>
          {switchHelp ? (
            <p className="mt-2 text-sm text-gray-500" data-testid="switch-help">
              {switchHelp}
            </p>
          ) : null}
          {downgradeTipLine ? (
            <p className="mt-1 text-sm text-gray-500" data-testid="switch-help-tip">
              {downgradeTipLine}
            </p>
          ) : null}
          {confirm.phase === 'idle' && confirm.expired ? (
            <p className="mt-2 text-sm text-gray-500" data-testid="confirm-expired">
              {UPGRADE_PREVIEW_EXPIRED}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )

  const chooseText = onChoosePlan ? (chooseLabelFor ? chooseLabelFor(selected.name) : (chooseLabel ?? 'Continue')) : CONTINUE_TO_PAYMENT
  const payArea = (
    <div className={cn('flex flex-col', stickyOnPhone ? STICKY_BAR : '')} data-testid="pay-area">
      {messages}
      <div>
        {/* Phone bar (Lina §0/§2): "<Name> · $<price>/month", then the grey note directly above the button. */}
        {totalBlock ?? phoneSummary}
        {onChoosePlan && noteAboveButton ? <p className="mb-3 text-sm text-gray-500">{noteAboveButton}</p> : null}
        <Button className="w-full" size="lg" onClick={startHostingCheckout} disabled={loading || !pickable(planStep)}>
          {loading ? <Loader2 className="animate-spin" size={22} /> : chooseText}
        </Button>
      </div>
    </div>
  )

  return (
    <div className={shell}>
      <RemovalOwedBox addons={removalOwedAddons} focus={focusRemovalOwed} />
      {hasLivePlan ? (
        <div className="mb-6 space-y-3" data-testid="plan-strip">
          <div className="text-sm text-gray-700">
            {currentPlanLines!.map((line) => (
              <p key={line} className="font-medium text-gray-900">
                {CURRENT_PLAN_LINE(line)}
              </p>
            ))}
          </div>
          {canSwitch && pendingChange ? (
            <div role="status" data-testid="pending-change" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p>{PENDING_CHANGE_LINE(pendingName, pendingChange.date)}</p>
              {tipText ? <p className="mt-1" data-testid="pending-tip-ends">{PLAN_CHANGE_TIP_ENDS_ON(tipText, pendingChange.date)}</p> : null}
              {currentStep ? (
                <Button variant="secondary" size="sm" className="mt-3 w-full sm:w-auto" onClick={keepCurrent} disabled={keeping || loading}>
                  {keeping ? <Loader2 className="animate-spin" size={18} /> : KEEP_PLAN_BUTTON(currentStep.name)}
                </Button>
              ) : null}
            </div>
          ) : null}
          {canSwitch && currentStep && currentStep.sellable && onPreviewTip && onChangeTip ? (
            <TipChangeBox
              step={currentStep}
              currentTipDollars={currentTipDollars}
              locked={Boolean(pendingChange)}
              lockedDate={pendingChange?.date ?? null}
              onPreviewTip={onPreviewTip}
              onChangeTip={onChangeTip}
              addonCents={liveAddonCents}
              amountOnly={liveAddons}
            />
          ) : null}
        </div>
      ) : null}
      {bare ? null : (
        <>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">{LADDER_HEADING}</h3>
          <p className="text-sm text-gray-500 mb-6">{LADDER_SUBHEADING}</p>
        </>
      )}
      <fieldset className="mb-6" disabled={!selectable}>
        <legend className="sr-only">{LADDER_HEADING}</legend>
        <div className={cn('grid gap-2', columns ? `lg:gap-3 ${COLS[main.length] ?? ''}` : '')}>
          {main.map((step) => pickRow(step))}
        </div>
        {soon.length > 0 ? (
          <div className="mt-4" data-testid="coming-soon-group">
            <div className="mb-2 hidden items-center gap-3 sm:flex">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{COMING_SOON_LABEL}</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            {soonHasCurrent ? null : (
              <button
                type="button"
                className="mb-2 min-h-[44px] text-sm font-medium text-gray-700 underline underline-offset-2 sm:hidden"
                aria-expanded={soonOpen}
                aria-controls={soonId}
                onClick={() => setSoonOpen((o) => !o)}
                data-testid="coming-soon-toggle"
              >
                {SEE_COMING_SOON(soon.length)}
              </button>
            )}
            <div
              id={soonId}
              className={cn(soonOpen || soonHasCurrent ? 'grid' : 'hidden', 'gap-2 sm:grid', columns ? `lg:gap-3 ${COLS[soon.length] ?? ''}` : '')}
            >
              {soon.map((step) => (step.id === currentStepId && canSwitch ? pickRow(step, true) : soonRow(step)))}
            </div>
          </div>
        ) : null}
      </fieldset>
      {checkoutAddons ? (
        <AddonsBlock
          mode="checkout"
          stepId={selected.id}
          selected={addonPicks}
          tipDollars={tipDollars}
          maxTipFor={maxTipFor}
          onChange={(ids, tip) => {
            setAddonPicks(ids)
            setTipDollars(tip)
          }}
          disabled={loading}
        />
      ) : liveAddons ? (
        <AddonsBlock
          mode="live"
          // Sable (L-2, Oct 4 9:29): the live block follows the plan the customer is ON, not the row
          // they're looking at (the switch acts on the current subscription).
          stepId={currentStepId ?? selected.id}
          current={currentAddons}
          ending={endingAddons}
          endDate={endingAddonsDate}
          lockedBySwitch={Boolean(pendingChange)}
          lockedBySwitchDate={pendingChange?.date ?? null}
          legacy={!currentStepId}
          onPreview={onPreviewAddon!}
          onChange={onChangeAddon!}
          onConfirmTotals={setConfirmTotals}
        />
      ) : null}
      {tipping ? (
        <div className="mb-6" data-testid="tip-area">
          <TipSlider
            step={selected}
            tipDollars={tipDollars}
            onChange={setTipDollars}
            onPickStep={pick}
            disabled={loading}
            addonCents={pickedAddonCents}
            amountOnly={checkoutAddons}
          />
        </div>
      ) : null}
      {hasLivePlan ? (
        <>
          {canSwitch ? switchArea : null}
          {/* Hidden while a change is pending: on this page it only reloads it (Lina §3a.6). */}
          {canSwitch && pendingChange ? null : (
            <form action={openBillingPortal}>
              <Button type="submit" className="w-full" size="lg" variant={canSwitch ? 'secondary' : undefined}>
                {t('dashboard.home.manageBilling')}
              </Button>
            </form>
          )}
        </>
      ) : canPay ? (
        payArea
      ) : !signedIn ? (
        <Link href={LOGIN_THEN_REQUEST} className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
          {t('plans.checkout.signRequestWebsite')}
        </Link>
      ) : (
        <Link href="/dashboard/request-website" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
          {t('plans.checkout.submitWebsiteRequestFirst')}
        </Link>
      )}
      {!canPay && !hasLivePlan ? (
        <p className="mt-3 text-sm text-gray-600">{t('plans.checkout.hostingCheckoutOpensAfterSubmit')}</p>
      ) : null}
    </div>
  )
}
