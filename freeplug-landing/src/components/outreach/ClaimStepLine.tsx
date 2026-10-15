import { STEP_NAMES } from '@/lib/outreach/copy'

/** Lina's step line: "Step 2 of 4 · Your details" with a thin red bar on a grey track. */
export function ClaimStepLine({ step }: { step: 1 | 2 | 3 | 4 }) {
  const total = STEP_NAMES.length
  return (
    <div data-testid="claim-step-line">
      <p className="text-sm font-medium text-gray-700">
        Step {step} of {total} · {STEP_NAMES[step - 1]}
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-label={`Step ${step} of ${total}`}
      >
        <div className="h-full rounded-full bg-[#ba3d3d]" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  )
}
