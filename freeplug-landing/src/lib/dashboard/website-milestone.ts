/** True when profile has a positive target and paid amount meets or exceeds it. */
export function milestoneWebsiteValueReached(
  targetCents: number | null | undefined,
  paidCents: number | null | undefined
): boolean {
  const target = targetCents ?? null
  const paid = paidCents ?? 0
  const hasTarget = target != null && target > 0
  return hasTarget && paid >= target
}
