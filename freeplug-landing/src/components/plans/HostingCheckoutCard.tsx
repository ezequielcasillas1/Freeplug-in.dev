'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { openBillingPortal } from '@/app/(dashboard)/dashboard/billing-actions'
import { PLAN_STEPS, type PlanStepId } from '@/lib/plans/ladder'
import {
  CONTINUE_TO_PAYMENT,
  EVERYTHING_IN,
  LADDER_HEADING,
  LADDER_SUBHEADING,
  MOST_POPULAR_LABEL,
  MOST_POPULAR_STEP,
  PER_MONTH,
  PERK_LINES,
  STARTER_BASE_LINES,
  STEP_BLURBS,
} from '@/lib/plans/ladder-copy'

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

const LOGIN_THEN_REQUEST = `/login?next=${encodeURIComponent('/dashboard/request-website')}`

type Props = {
  /** When false, section uses neutral background (e.g. dashboard). */
  embedded?: boolean
  /** Default true (dashboard). Landing passes actual session. */
  signedIn?: boolean
  /** Requires a submitted website request; enforced on API too. Default true. */
  allowCheckout?: boolean
  /**
   * Lines describing the customer's live plan(s). When non-empty, checkout is replaced by
   * Manage billing (the API refuses a second plan with 409 too).
   */
  currentPlanLines?: string[]
  /**
   * Choose-plan mode (outreach claim step 3): the button saves the plan through this callback
   * instead of opening Checkout; nothing is charged. Returns an error message or null.
   */
  onChoosePlan?: (plan: { planStep: PlanStepId }) => Promise<string | null>
  /** Button label in choose-plan mode. */
  chooseLabel?: string
  /** One grey line above the button in choose-plan mode. */
  noteAboveButton?: string
}

export function HostingCheckoutCard({
  embedded = false,
  signedIn = true,
  allowCheckout = true,
  currentPlanLines,
  onChoosePlan,
  chooseLabel,
  noteAboveButton,
}: Props) {
  const [planStep, setPlanStep] = useState<PlanStepId>(PLAN_STEPS[0].id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const hasLivePlan = (currentPlanLines?.length ?? 0) > 0
  const canPay = signedIn && allowCheckout && !hasLivePlan

  const shell =
    embedded
      ? 'rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-zinc-200/80'
      : 'rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-zinc-200/80'

  return (
    <div className={shell}>
      <h3 className="text-xl font-semibold text-gray-900 mb-1">{LADDER_HEADING}</h3>
      <p className="text-sm text-gray-500 mb-6">{LADDER_SUBHEADING}</p>
      <fieldset className="mb-6" disabled={!canPay}>
        <legend className="sr-only">{LADDER_HEADING}</legend>
        <div className="space-y-2">
          {PLAN_STEPS.map((step, i) => {
            const selected = planStep === step.id
            const lines = i === 0 ? STARTER_BASE_LINES : step.adds.map((perk) => PERK_LINES[perk])
            return (
              <label
                key={step.id}
                data-plan-step={step.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  selected ? 'border-[#ba3d3d]' : 'border-gray-200'
                } ${canPay ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
              >
                <input
                  type="radio"
                  name="plan-step"
                  value={step.id}
                  checked={selected}
                  onChange={() => setPlanStep(step.id)}
                  className="mt-1 text-[#ba3d3d] focus:ring-[#ba3d3d]"
                />
                <span className="text-sm text-gray-700">
                  <span className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
                    {step.name} · {formatDollars(step.monthlyCents)}
                    {PER_MONTH}
                    {MOST_POPULAR_STEP === step.id ? (
                      <span className="rounded bg-[#ba3d3d]/10 px-1.5 text-[11px] font-semibold text-[#ba3d3d]">
                        {MOST_POPULAR_LABEL}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-gray-500">{STEP_BLURBS[step.id]}</span>
                  {i > 0 ? (
                    <span className="block text-gray-500">{EVERYTHING_IN(PLAN_STEPS[i - 1].name)}</span>
                  ) : null}
                  <ul className="mt-1 list-disc pl-4 text-gray-600">
                    {lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
      {hasLivePlan ? (
        <>
          <div className="mb-3 text-sm text-gray-700">
            {currentPlanLines!.map((line) => (
              <p key={line}>Current plan: {line}</p>
            ))}
          </div>
          <form action={openBillingPortal}>
            <Button type="submit" className="w-full" size="lg">
              Manage billing
            </Button>
          </form>
        </>
      ) : canPay ? (
        <>
          {onChoosePlan && noteAboveButton ? (
            <p className="mb-3 text-sm text-gray-500">{noteAboveButton}</p>
          ) : null}
          <Button
            className="w-full"
            size="lg"
            onClick={startHostingCheckout}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={22} />
            ) : onChoosePlan ? (
              chooseLabel ?? 'Continue'
            ) : (
              CONTINUE_TO_PAYMENT
            )}
          </Button>
        </>
      ) : !signedIn ? (
        <Link
          href={LOGIN_THEN_REQUEST}
          className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
        >
          Sign in & request a website
        </Link>
      ) : (
        <Link
          href="/dashboard/request-website"
          className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
        >
          Submit a website request first
        </Link>
      )}
      {!canPay && !hasLivePlan ? (
        <p className="mt-3 text-sm text-gray-600">
          Hosting checkout opens after you submit a website request from your dashboard.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
