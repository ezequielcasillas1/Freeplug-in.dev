/**
 * Warning text for a plan set to end; falls back to the period wording when the date is missing.
 * Sable, Oct 3 5:23 PM: "Your Fast lane plan will end in 31 days. Resume to keep your website live."
 * `planName` is the plan name only (never "+ Optional monthly tip"; the tip ends with the plan anyway).
 * A ladder step gets " plan" after its name; a grandfathered plan's product names already say what it
 * is ("Hosting plan (monthly) + Pro add-on (monthly)"), so they get no extra "plan".
 */
export function subscriptionEndingMessage(planName: string, daysUntilEnd: number | null, ladderStep = false): string {
  const subject = ladderStep ? `Your ${planName} plan` : `Your ${planName}`
  if (daysUntilEnd == null) {
    return `${subject} will end at the end of the current billing period. Resume to keep your website live.`
  }
  return `${subject} will end in ${daysUntilEnd} day${daysUntilEnd === 1 ? '' : 's'}. Resume to keep your website live.`
}

/** Where the "Subscription ending" alert's "Resume plan" goes: the cancel page's Resume box (Vera B3). */
export const RESUME_PLAN_ANCHOR_HREF = '/dashboard/cancel#resume-plan'
