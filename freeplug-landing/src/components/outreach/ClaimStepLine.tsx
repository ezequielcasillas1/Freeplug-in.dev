import { STEP_NAMES } from '@/lib/outreach/copy'

/** Lina's step line: "Step 2 of 4 · Your details" with a thin red bar on a grey track. */
const ES_STEP_NAMES = ['Cuenta', 'Tus datos', 'Plan de hosting', 'Agregar tarjeta'] as const

export function ClaimStepLine({ step, es = false }: { step: 1 | 2 | 3 | 4; es?: boolean }) {
  const total = STEP_NAMES.length
  const names = es ? ES_STEP_NAMES : STEP_NAMES
  const word = es ? { step: 'Paso', of: 'de' } : { step: 'Step', of: 'of' }
  return (
    <div data-testid="claim-step-line">
      <p className="text-sm font-medium text-gray-700">
        {word.step} {step} {word.of} {total} · {names[step - 1]}
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-label={`${word.step} ${step} ${word.of} ${total}`}
      >
        <div className="h-full rounded-full bg-[#ba3d3d]" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  )
}
