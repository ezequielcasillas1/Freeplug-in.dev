import { STEP_NAMES } from '@/lib/outreach/copy'

/** Lina's step line: "Step 2 of 4 · Your details" with a thin red bar on a grey track. */
/** Optional translated labels (ES from messages auth.signup.claim.step*); EN uses STEP_NAMES. */
export type ClaimStepLabels = { line: (n: number, total: number, name: string) => string; aria: (n: number, total: number) => string; names: readonly string[] }

export function ClaimStepLine({ step, labels }: { step: 1 | 2 | 3 | 4; labels?: ClaimStepLabels }) {
  const total = STEP_NAMES.length
  const name = (labels?.names ?? STEP_NAMES)[step - 1]
  const line = labels ? labels.line(step, total, name) : `Step ${step} of ${total} · ${name}`
  const aria = labels ? labels.aria(step, total) : `Step ${step} of ${total}`
  return (
    <div data-testid="claim-step-line">
      <p className="text-sm font-medium text-gray-700">
        {line}
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-label={aria}
      >
        <div className="h-full rounded-full bg-[#ba3d3d]" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  )
}
