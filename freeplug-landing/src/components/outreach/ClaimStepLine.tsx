import enMessages from '../../../messages/en.json'
import esMessages from '../../../messages/es.json'
import { STEP_NAMES } from '@/lib/outreach/copy'

/** Lina's step line: "Step 2 of 4 · Your details" with a thin red bar on a grey track. */
/** Every label comes from messages auth.signup.claim.step* (EN equals the locked STEP_NAMES; copy.test guards it). */
export const CLAIM_STEP_KEYS = ['account', 'details', 'plan', 'card'] as const

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m))

/** Sync on purpose: also rendered by /claim (outside [locale]) and in client tests. */
export function ClaimStepLine({ step, locale = 'en' }: { step: 1 | 2 | 3 | 4; locale?: string }) {
  const c = (locale === 'es' ? esMessages : enMessages).auth.signup.claim
  const total = STEP_NAMES.length
  const name = c.stepNames[CLAIM_STEP_KEYS[step - 1]]
  const line = fill(c.stepLine, { n: step, total, name })
  const aria = fill(c.stepAria, { n: step, total })
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
