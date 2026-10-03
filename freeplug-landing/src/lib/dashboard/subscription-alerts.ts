/**
 * Warning text for a plan set to end; falls back to the period wording when the date is missing.
 * `planName` is the plan name only (Sable, Oct 3 5:11 PM; Vera B3): "Fast lane will end in 31 days.",
 * never "+ Optional monthly tip" (the tip ends with the plan anyway).
 */
export function subscriptionEndingMessage(planName: string, daysUntilEnd: number | null): string {
  if (daysUntilEnd == null) {
    return `${planName} will end at the end of the current billing period. Resume to keep your website live.`
  }
  return `${planName} will end in ${daysUntilEnd} day${daysUntilEnd === 1 ? '' : 's'}. Resume to keep your website live.`
}

/** Where the "Subscription ending" alert's "Resume plan" goes: the cancel page's Resume box (Vera B3). */
export const RESUME_PLAN_ANCHOR_HREF = '/dashboard/cancel#resume-plan'
