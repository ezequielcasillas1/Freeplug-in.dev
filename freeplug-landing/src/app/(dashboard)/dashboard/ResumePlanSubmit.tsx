'use client'

import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * Submit button for the "Resume plan" forms (dashboard alert, cancel page). Disabled while its form is
 * submitting, so a double click sends one resume (Vera B1). A second tab can still submit; the server
 * re-reads Stripe and shows the resumed state when the plan is no longer set to end.
 */
export function ResumePlanSubmit({ className, children }: { className?: string; children: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
      data-testid="resume-plan-submit"
    >
      {children}
    </button>
  )
}
