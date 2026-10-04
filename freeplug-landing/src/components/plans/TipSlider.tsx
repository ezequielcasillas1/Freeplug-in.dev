'use client'

import { useId } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { PlanStep, PlanStepId } from '@/lib/plans/ladder'
import { tipNudge, tipRangeFor } from '@/lib/plans/tips'
import { ladderCopy, type LadderCopy } from '@/lib/plans/ladder-copy'
import { useLadderCopy } from '@/lib/plans/use-ladder-copy'

const usd = (dollars: number) => `$${dollars}`

/** "$65 + $5 tip = $70/month" (or "$65/month, no tip"); shared by the slider and the phone bar. */
export function tipTotalText(step: Pick<PlanStep, 'monthlyCents'>, tipDollars: number, copy: LadderCopy = ladderCopy()): string {
  const price = Math.round(step.monthlyCents / 100)
  return copy.TIP_TOTAL_LINE(usd(price), tipDollars > 0 ? usd(tipDollars) : null, usd(price + tipDollars))
}

type Props = {
  step: PlanStep
  tipDollars: number
  onChange: (tipDollars: number) => void
  /** Nudge button: pick the next step instead (the caller resets the tip). Omit = no nudge shown. */
  onPickStep?: (id: PlanStepId) => void
  disabled?: boolean
  /** Lines under the slider (e.g. the tip box's note); defaults to the help line. */
  help?: string
  testId?: string
  /** Add-ons on (cents): Starter counts them toward its total, so the tip max comes down (tips.ts). */
  addonCents?: number
  /** With the add-ons block: show the tip amount only; the one total sits in the action area (Lina, Oct 4). */
  amountOnly?: boolean
}

/**
 * The tipping system's slider (Oct 3): an optional monthly extra on top of a step's price. A labelled
 * native range input (keyboard: arrows move $1, Home/End jump to the ends), with aria-valuetext in
 * dollars and a readable total next to the label. It starts at the step price (no tip). Steps that
 * aren't sold get no slider (tipRangeFor = null). The server re-checks every amount.
 * Lina, round 5b: a hint between the total and the bar; − / + buttons (44×44, $1 each, clamped and
 * disabled at their end) beside the bar; end labels in tip amounts ("No tip" / "$19 tip") in every
 * state, never plan totals (the total stays in the top-right line). Brand-red fill, round handle.
 */
const stepBtn =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ba3d3d] disabled:cursor-not-allowed disabled:opacity-40'

const fmt = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

export function TipSlider({ step, tipDollars, onChange, onPickStep, disabled, help: helpProp, testId = 'tip-slider', addonCents = 0, amountOnly = false }: Props) {
  const copy = useLadderCopy()
  const help = helpProp ?? copy.TIP_SLIDER_HELP
  const { TIP_END_MAX, TIP_END_NONE, TIP_LOWER_LABEL, TIP_NUDGE, TIP_NUDGE_BUTTON, TIP_NUDGE_PERK, TIP_RAISE_LABEL, TIP_SLIDER_HINT, TIP_SLIDER_LABEL, TIP_VALUETEXT, tipAmountLine } = copy
  const id = useId()
  const helpId = `${id}-help`
  const hintId = `${id}-hint`
  const range = tipRangeFor(step, undefined, addonCents)
  if (!range || range.maxTip <= 0) return null
  const tip = Math.min(Math.max(0, tipDollars), range.maxTip)
  const total = range.minTotal + tip
  const nudge = onPickStep ? tipNudge(step, tip, undefined, addonCents) : null
  const set = (t: number) => onChange(Math.min(Math.max(0, t), range.maxTip))
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4" data-testid={testId} data-step={step.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-medium text-gray-900">
          {TIP_SLIDER_LABEL}
        </label>
        {/* Visible total; screen readers get the same through aria-valuetext, so it isn't announced twice. */}
        <output htmlFor={id} aria-live="off" className="text-sm font-semibold text-gray-900" data-testid="tip-total">
          {amountOnly ? tipAmountLine(tip) : tipTotalText(step, tip, copy)}
        </output>
      </div>
      <p id={hintId} className="mt-1 text-xs text-gray-600" data-testid="tip-hint">
        {TIP_SLIDER_HINT}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          className={stepBtn}
          aria-label={TIP_LOWER_LABEL}
          disabled={disabled || tip <= 0}
          onClick={() => set(tip - 1)}
          data-testid="tip-minus"
        >
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
        <input
          id={id}
          type="range"
          min={range.minTotal}
          max={range.maxTotal}
          step={1}
          value={total}
          disabled={disabled}
          aria-valuetext={TIP_VALUETEXT(fmt(step.monthlyCents + addonCents + tip * 100), tip > 0 ? usd(tip) : null)}
          aria-describedby={`${hintId} ${helpId}`}
          onChange={(e) => set(Number(e.currentTarget.value) - range.minTotal)}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-[#ba3d3d] disabled:cursor-not-allowed"
          data-testid="tip-range"
        />
        <button
          type="button"
          className={stepBtn}
          aria-label={TIP_RAISE_LABEL}
          disabled={disabled || tip >= range.maxTip}
          onClick={() => set(tip + 1)}
          data-testid="tip-plus"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {/* Tip amounts at the ends, lined up with the bar (inset by a button + gap). */}
      <div className="flex justify-between px-[3.25rem] text-xs text-gray-500" aria-hidden="true" data-testid="tip-ends">
        <span>{TIP_END_NONE}</span>
        <span>{TIP_END_MAX(usd(range.maxTip))}</span>
      </div>
      <p id={helpId} className="mt-2 text-xs text-gray-500">
        {help}
      </p>
      {nudge ? (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-gray-800" data-testid="tip-nudge">
          <p>{TIP_NUDGE(nudge.next.name, usd(Math.round(nudge.next.monthlyCents / 100)), TIP_NUDGE_PERK[nudge.perk])}</p>
          <button
            type="button"
            className="mt-1 min-h-[44px] text-sm font-medium text-[#ba3d3d] underline underline-offset-2"
            onClick={() => onPickStep?.(nudge.next.id)}
            disabled={disabled}
            data-testid="tip-nudge-button"
          >
            {TIP_NUDGE_BUTTON(nudge.next.name)}
          </button>
        </div>
      ) : null}
    </div>
  )
}
