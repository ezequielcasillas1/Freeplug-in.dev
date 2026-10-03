'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { openBillingPortal } from '@/app/(dashboard)/dashboard/billing-actions'
import type { ChangeHostingPlanResult, PlanPreviewResponse } from '@/app/(dashboard)/dashboard/billing-actions'
import { PLAN_STEPS, type PlanStep, type PlanStepId } from '@/lib/plans/ladder'
import { PRORATION_DATE_MAX_AGE_SECONDS, planMove, type PlanMove } from '@/lib/plans/plan-direction'
import {
  CHANGE_PLAN_BUTTON_NOW,
  CHANGE_PLAN_BUTTON_ON,
  CHANGE_PLAN_BUTTON,
  CHANGE_PLAN_CURRENT,
  CHANGE_PLAN_HELP_DOWN,
  CHANGE_PLAN_HELP_UP,
  CHANGE_PLAN_PICK_TO_SWITCH,
  COMING_SOON_LABEL,
  CONTINUE_TO_PAYMENT,
  CURRENT_PLAN_LINE,
  KEEP_PLAN_BUTTON,
  PENDING_CHANGE_LINE,
  EVERYTHING_IN,
  LADDER_HEADING,
  LADDER_SUBHEADING,
  MOST_POPULAR_LABEL,
  MOST_POPULAR_STEP,
  PER_MONTH,
  PERK_LINES,
  SEE_COMING_SOON,
  STARTS_ON_BADGE,
  aiEditsLine,
  STARTER_BASE_LINES,
  UPGRADE_CALCULATING,
  UPGRADE_CANCEL_BUTTON,
  UPGRADE_CONFIRM_BUTTON,
  UPGRADE_CONFIRM_FALLBACK,
  UPGRADE_CONFIRM_LINE,
  UPGRADE_PREVIEW_EXPIRED,
} from '@/lib/plans/ladder-copy'

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
  onChoosePlan?: (plan: { planStep: PlanStepId }) => Promise<string | null>
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
}

/** Upgrade confirm states (Lina §3a). Downgrades and checkout never enter it. */
type ConfirmState =
  | { phase: 'idle'; expired: boolean }
  | { phase: 'loading'; step: PlanStepId }
  | { phase: 'confirm' | 'submitting'; step: PlanStepId; text: string; prorationDate?: number }

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
  onChangePlan,
  onPreviewChange,
  pendingChange = null,
  layout = 'stacked',
  bare = false,
  stickyOnPhone = false,
}: Props) {
  // sellable=false steps (ladder.ts) show "Coming soon" and can't be picked, except the step a
  // customer is already on. The server refuses them too (checkout, claim, publish, switching).
  const pickable = (id: PlanStepId) => id === currentStepId || PLAN_STEPS.some((s) => s.id === id && s.sellable)
  const [planStep, setPlanStep] = useState<PlanStepId>(
    currentStepId ?? PLAN_STEPS.find((s) => s.sellable)?.id ?? PLAN_STEPS[0].id
  )
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

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clearTimer, [])

  const closeConfirm = useCallback((expired: boolean) => {
    clearTimer()
    setConfirm({ phase: 'idle', expired })
    // Back to the switch button (Lina §3a: Esc and Cancel return focus to it).
    setTimeout(() => switchRef.current?.focus(), 0)
  }, [])

  // Focus moves to Confirm when the confirm appears; Esc closes it.
  useEffect(() => {
    if (confirm.phase !== 'confirm') return
    confirmRef.current?.focus()
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
      setError('Network error. Try again.')
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
    setConfirm({ phase: 'loading', step })
    let text = UPGRADE_CONFIRM_FALLBACK(name)
    let prorationDate: number | undefined
    try {
      const p = await onPreviewChange(step)
      if (p.ok && p.nextDate) {
        text = UPGRADE_CONFIRM_LINE(name, formatCharge(p.amountDueCents), formatDollars(p.nextAmountCents), p.nextDate)
      }
      prorationDate = p.prorationDate ?? undefined
    } catch {
      // network: the fallback line, and the server charges at the time of Confirm
    }
    setConfirm({ phase: 'confirm', step, text, prorationDate })
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
      setError('Network error. Try again.')
    } finally {
      setKeeping(false)
    }
  }

  function pick(id: PlanStepId) {
    setPlanStep(id)
    // A new pick closes an open confirm (its amount was for the old pick).
    if (confirm.phase === 'confirm') {
      clearTimer()
      setConfirm({ phase: 'idle', expired: false })
    } else if (confirm.phase === 'idle' && confirm.expired) setConfirm({ phase: 'idle', expired: false })
  }

  async function startHostingCheckout() {
    setError(null)
    setLoading(true)
    if (onChoosePlan) {
      try {
        const message = await onChoosePlan({ planStep })
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
        body: JSON.stringify({ planStep }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('No checkout URL returned. Try again.')
      }
    } catch {
      setError('Network error. Try again.')
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
          {badgesFor(step)}
          {body(step)}
        </span>
      </label>
    )
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
          ? CHANGE_PLAN_BUTTON_ON(selected.name, renewalDate)
          : CHANGE_PLAN_BUTTON(selected.name)
  const switchHelp = direction === 'upgrade' ? CHANGE_PLAN_HELP_UP : direction === 'downgrade' ? CHANGE_PLAN_HELP_DOWN : null
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
  const phoneSummary = stickyOnPhone ? (
    <p className="mb-2 text-xs text-gray-600 sm:hidden" data-testid="sticky-summary">
      {selected.name} · {formatDollars(selected.monthlyCents)}
      {PER_MONTH}
    </p>
  ) : null

  const switchArea = (
    <div className={cn('flex flex-col', stickyOnPhone ? STICKY_BAR : '')} data-testid="switch-area">
      {messages}
      {/* Live region: "Calculating…" and the confirm line are read out (Lina §3a). */}
      <p role="status" aria-live="polite" className="sr-only" data-testid="confirm-live">
        {confirm.phase === 'loading' ? UPGRADE_CALCULATING : confirm.phase === 'confirm' || confirm.phase === 'submitting' ? confirm.text : ''}
      </p>
      {confirm.phase === 'loading' ? (
        <div data-testid="upgrade-calculating">
          {phoneSummary}
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
          <Button ref={confirmRef} className="w-full" size="lg" onClick={onConfirm} disabled={confirm.phase === 'submitting'}>
            {confirm.phase === 'submitting' ? <Loader2 className="animate-spin" size={22} aria-label={UPGRADE_CONFIRM_BUTTON} /> : UPGRADE_CONFIRM_BUTTON}
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => closeConfirm(false)} disabled={confirm.phase === 'submitting'}>
            {UPGRADE_CANCEL_BUTTON}
          </Button>
        </div>
      ) : (
        <div>
          {phoneSummary}
          <Button ref={switchRef} className="w-full" size="lg" onClick={onSwitch} disabled={switchDisabled}>
            {loading ? <Loader2 className="animate-spin" size={22} /> : switchLabel}
          </Button>
          {switchHelp ? (
            <p className="mt-2 text-sm text-gray-500" data-testid="switch-help">
              {switchHelp}
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
        {phoneSummary}
        {onChoosePlan && noteAboveButton ? <p className="mb-3 text-sm text-gray-500">{noteAboveButton}</p> : null}
        <Button className="w-full" size="lg" onClick={startHostingCheckout} disabled={loading || !pickable(planStep)}>
          {loading ? <Loader2 className="animate-spin" size={22} /> : chooseText}
        </Button>
      </div>
    </div>
  )

  return (
    <div className={shell}>
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
              {currentStep ? (
                <Button variant="secondary" size="sm" className="mt-3 w-full sm:w-auto" onClick={keepCurrent} disabled={keeping || loading}>
                  {keeping ? <Loader2 className="animate-spin" size={18} /> : KEEP_PLAN_BUTTON(currentStep.name)}
                </Button>
              ) : null}
            </div>
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
      {hasLivePlan ? (
        <>
          {canSwitch ? <div className="mb-3">{switchArea}</div> : null}
          {/* Hidden while a change is pending: on this page it only reloads it (Lina §3a.6). */}
          {canSwitch && pendingChange ? null : (
            <form action={openBillingPortal}>
              <Button type="submit" className="w-full" size="lg" variant={canSwitch ? 'secondary' : undefined}>
                Manage billing
              </Button>
            </form>
          )}
        </>
      ) : canPay ? (
        payArea
      ) : !signedIn ? (
        <Link href={LOGIN_THEN_REQUEST} className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
          Sign in & request a website
        </Link>
      ) : (
        <Link href="/dashboard/request-website" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
          Submit a website request first
        </Link>
      )}
      {!canPay && !hasLivePlan ? (
        <p className="mt-3 text-sm text-gray-600">Hosting checkout opens after you submit a website request from your dashboard.</p>
      ) : null}
    </div>
  )
}
