'use client'

import { useId } from 'react'
import type { PlanStep, PlanStepId } from '@/lib/plans/ladder'
import { tipNudge, tipRangeFor } from '@/lib/plans/tips'
import {
  TIP_NUDGE,
  TIP_NUDGE_BUTTON,
  TIP_NUDGE_PERK,
  TIP_SLIDER_HELP,
  TIP_SLIDER_LABEL,
  TIP_TOTAL_LINE,
  TIP_VALUETEXT,
} from '@/lib/plans/ladder-copy'

const usd = (dollars: number) => `$${dollars}`

/** "$65 + $5 tip = $70/month" (or "$65/month, no tip"); shared by the slider and the phone bar. */
export function tipTotalText(step: Pick<PlanStep, 'monthlyCents'>, tipDollars: number): string {
  const price = Math.round(step.monthlyCents / 100)
  return TIP_TOTAL_LINE(usd(price), tipDollars > 0 ? usd(tipDollars) : null, usd(price + tipDollars))
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
}

/**
 * The tipping system's slider (Oct 3): an optional monthly extra on top of a step's price. A labelled
 * native range input (keyboard: arrows move $1, Home/End jump to the ends), with aria-valuetext in
 * dollars and a readable total next to the label. It starts at the step price (no tip). Steps that
 * aren't sold get no slider (tipRangeFor = null). The server re-checks every amount.
 */
export function TipSlider({ step, tipDollars, onChange, onPickStep, disabled, help = TIP_SLIDER_HELP, testId = 'tip-slider' }: Props) {
  const id = useId()
  const helpId = `${id}-help`
  const range = tipRangeFor(step)
  if (!range || range.maxTip <= 0) return null
  const tip = Math.min(Math.max(0, tipDollars), range.maxTip)
  const total = range.minTotal + tip
  const nudge = onPickStep ? tipNudge(step, tip) : null
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4" data-testid={testId} data-step={step.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-medium text-gray-900">
          {TIP_SLIDER_LABEL}
        </label>
        {/* Visible total; screen readers get the same through aria-valuetext, so it isn't announced twice. */}
        <output htmlFor={id} aria-live="off" className="text-sm font-semibold text-gray-900" data-testid="tip-total">
          {tipTotalText(step, tip)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={range.minTotal}
        max={range.maxTotal}
        step={1}
        value={total}
        disabled={disabled}
        aria-valuetext={TIP_VALUETEXT(usd(total), tip > 0 ? usd(tip) : null)}
        aria-describedby={helpId}
        onChange={(e) => onChange(Number(e.currentTarget.value) - range.minTotal)}
        className="mt-2 h-11 w-full cursor-pointer accent-[#ba3d3d] disabled:cursor-not-allowed"
        data-testid="tip-range"
      />
      <div className="flex justify-between text-xs text-gray-500" aria-hidden="true">
        <span>{usd(range.minTotal)}</span>
        <span>{usd(range.maxTotal)}</span>
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
