/**
 * Billing Portal session params (hosting ladder, Oct 3). STRIPE_PORTAL_CONFIGURATION_ID (optional,
 * not a secret, bpc_...) selects the ladder configuration made by
 * scripts/stripe-test-setup-ladder.mjs: switch between the six step prices, upgrades immediate and
 * prorated, downgrades at period end. Unset (or not a bpc_ id): Stripe's default configuration.
 */
export function portalConfigurationId(env: Record<string, string | undefined> = process.env): string | undefined {
  const id = env.STRIPE_PORTAL_CONFIGURATION_ID?.trim()
  return id && /^bpc_[A-Za-z0-9]+$/.test(id) ? id : undefined
}

export function billingPortalSessionParams(
  customer: string,
  returnUrl: string,
  env: Record<string, string | undefined> = process.env
): { customer: string; return_url: string; configuration?: string } {
  const configuration = portalConfigurationId(env)
  return { customer, return_url: returnUrl, ...(configuration ? { configuration } : {}) }
}
