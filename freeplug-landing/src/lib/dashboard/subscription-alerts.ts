/** Warning text for a plan set to end; falls back to the period wording when the date is missing. */
export function subscriptionEndingMessage(productName: string, daysUntilEnd: number | null): string {
  if (daysUntilEnd == null) {
    return `Your ${productName} will end at the end of the current billing period. Resume to keep your website live.`
  }
  return `Your ${productName} will end in ${daysUntilEnd} day${daysUntilEnd === 1 ? '' : 's'}. Resume to keep your website live.`
}
