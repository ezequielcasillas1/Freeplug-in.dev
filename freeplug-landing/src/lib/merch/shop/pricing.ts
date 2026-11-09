/** retail = ceil(cost / 0.55) to next dollar minus one cent → $X.99 */
export function retailCentsFromCostCents(costCents: number): number {
  if (!Number.isFinite(costCents) || costCents < 0) return 0
  const dollars = costCents / 100 / 0.55
  const ceil = Math.ceil(dollars)
  return ceil * 100 - 1
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}
