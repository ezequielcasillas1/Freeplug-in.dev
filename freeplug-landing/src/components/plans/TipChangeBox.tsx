'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PlanStep } from '@/lib/plans/ladder'
import type { ChangeTipResponse, TipPreviewResponse } from '@/app/(dashboard)/dashboard/billing-actions'
import {
  TIP_CHANGE_BUTTON,
  TIP_CHANGE_HEADING,
  TIP_CHANGE_NOTE,
  TIP_CHANGE_PENDING,
  TIP_CHANGED,
  TIP_END_NONE,
  TIP_LOCKED_AMOUNT,
  TIP_LOCKED_NOTE,
  TIP_NEXT_BILL,
  TIP_NEXT_BILL_NO_DATE,
  UPGRADE_CALCULATING,
  UPGRADE_CANCEL_BUTTON,
  UPGRADE_CONFIRM_BUTTON,
} from '@/lib/plans/ladder-copy'
import { TipSlider } from './TipSlider'

const charge = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

type Phase =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'confirm' | 'submitting'; text: string; tipDollars: number; confirmId?: string }

type Props = {
  step: PlanStep
  currentTipDollars: number
  /** A switch is planned: the tip can't change now (it ends at the switch). */
  locked: boolean
  /** The planned switch's date ("November 3, 2026") for the locked note. */
  lockedDate?: string | null
  onPreviewTip: (tipDollars: number) => Promise<TipPreviewResponse>
  /** confirmId: from the preview this Confirm belongs to (one Stripe idempotency key per Confirm). */
  onChangeTip: (tipDollars: number, confirmId?: string) => Promise<ChangeTipResponse>
}

/**
 * Plans page, live ladder plan: change the monthly tip (the tipping system). Same pattern as the
 * upgrade confirm (Lina §3a, no modal): Update tip -> "Checking the amount…" -> "Your next bill will be $X
 * on <date>." with Confirm / Not now. The change starts with the next bill (proration none); nothing is
 * charged today. Esc closes the confirm and focus returns to the button.
 */
export function TipChangeBox({ step, currentTipDollars, locked, lockedDate = null, onPreviewTip, onChangeTip }: Props) {
  const [tip, setTip] = useState(currentTipDollars)
  const [state, setState] = useState<Phase>({ phase: 'idle' })
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // A new saved tip from the server (after router.refresh) resets the slider: adjust during render,
  // not in an effect (React "you might not need an effect").
  const [savedTip, setSavedTip] = useState(currentTipDollars)
  if (savedTip !== currentTipDollars) {
    setSavedTip(currentTipDollars)
    setTip(currentTipDollars)
  }

  const close = useCallback(() => {
    setState({ phase: 'idle' })
    setTimeout(() => buttonRef.current?.focus(), 0)
  }, [])
  useEffect(() => {
    if (state.phase !== 'confirm') return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state.phase, close])

  async function onUpdate() {
    setError(null)
    setNotice(null)
    setState({ phase: 'loading' })
    try {
      const p = await onPreviewTip(tip)
      if (!p.ok) {
        setError(p.message)
        setState({ phase: 'idle' })
        return
      }
      const text = p.nextDate ? TIP_NEXT_BILL(charge(p.nextAmountCents), p.nextDate) : TIP_NEXT_BILL_NO_DATE(charge(p.nextAmountCents))
      setState({ phase: 'confirm', text, tipDollars: tip, confirmId: p.confirmId })
    } catch {
      setError('Network error. Try again.')
      setState({ phase: 'idle' })
    }
  }

  async function onConfirm() {
    if (state.phase !== 'confirm') return
    setState({ ...state, phase: 'submitting' })
    try {
      const r = await onChangeTip(state.tipDollars, state.confirmId)
      if (r.ok) setNotice(TIP_CHANGED(state.text))
      else setError(r.message)
    } catch {
      setError('Network error. Try again.')
    }
    close()
  }

  const busy = state.phase !== 'idle'
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4" aria-labelledby="tip-box-heading" data-testid="tip-change-box">
      <h4 id="tip-box-heading" className="text-sm font-semibold text-gray-900">
        {TIP_CHANGE_HEADING}
      </h4>
      {locked ? (
        // Lina, round 5b: a switch is planned, so no bar or end labels, just the saved tip, read-only.
        // The amber pending box above keeps its tip-ends line.
        <div className="mt-2" data-testid="tip-locked">
          <p className="flex items-center gap-2 text-sm text-gray-900">
            <Lock className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            <span data-testid="tip-locked-amount">{currentTipDollars > 0 ? TIP_LOCKED_AMOUNT(`$${currentTipDollars}`) : TIP_END_NONE}</span>
          </p>
          <p className="mt-1 text-xs text-gray-500" data-testid="tip-locked-note">
            {currentTipDollars > 0 && lockedDate ? TIP_LOCKED_NOTE(lockedDate) : TIP_CHANGE_PENDING}
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <TipSlider
            step={step}
            tipDollars={tip}
            onChange={(t) => {
              setTip(t)
              setNotice(null)
            }}
            disabled={busy}
            help={TIP_CHANGE_NOTE}
            testId="tip-change-slider"
          />
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only" data-testid="tip-change-live">
        {state.phase === 'loading' ? UPGRADE_CALCULATING : state.phase === 'confirm' || state.phase === 'submitting' ? state.text : (notice ?? '')}
      </p>
      {notice ? (
        <p className="mt-3 text-sm text-green-700" data-testid="tip-change-notice">
          {notice}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {state.phase === 'confirm' || state.phase === 'submitting' ? (
        <div className="mt-3" data-testid="tip-change-confirm">
          <p className="mb-3 text-sm text-gray-900" aria-hidden="true">
            {state.text}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button ref={confirmRef} onClick={onConfirm} disabled={state.phase === 'submitting'} className="sm:w-auto">
              {state.phase === 'submitting' ? <Loader2 className="animate-spin" size={20} aria-label={UPGRADE_CONFIRM_BUTTON} /> : UPGRADE_CONFIRM_BUTTON}
            </Button>
            <Button variant="ghost" onClick={close} disabled={state.phase === 'submitting'}>
              {UPGRADE_CANCEL_BUTTON}
            </Button>
          </div>
        </div>
      ) : locked ? null : (
        <Button
          ref={buttonRef}
          variant="secondary"
          className="mt-3 w-full sm:w-auto"
          onClick={onUpdate}
          disabled={busy || tip === currentTipDollars}
          data-testid="tip-change-button"
        >
          {state.phase === 'loading' ? (
            <>
              <Loader2 className="mr-2 animate-spin" size={18} aria-hidden="true" />
              {UPGRADE_CALCULATING}
            </>
          ) : (
            TIP_CHANGE_BUTTON
          )}
        </Button>
      )}
    </section>
  )
}
