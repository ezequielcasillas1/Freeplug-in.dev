/**
 * Billing Portal scope (Aria, Oct 3 4:05 PM): the portal only ever updates the card.
 *
 * - Every portal session (Manage billing and Update card) is a payment_method_update flow
 *   (flow_data) that returns to the Plans page, on the DEDICATED configuration whose id is in
 *   STRIPE_PORTAL_CONFIGURATION_ID (not a secret, bpc_...). That configuration has only
 *   payment_method_update on; subscription_cancel, subscription_update, customer_update and
 *   invoice_history are off (CARD_ONLY_PORTAL_FEATURES, created by
 *   scripts/stripe-portal-config.mjs in TEST mode; the live one is created only at launch, with
 *   Ezequiel's yes).
 * - Without a valid id the app refuses to open the portal (PortalNotConfiguredError). It never falls
 *   back to the account's default configuration, which allows cancel and customer edits.
 * - Plan changes, cancel and resume happen in the app only, under the change-plan lock
 *   (src/lib/stripe/change-plan.ts, resume-hosting.ts, billing-actions.ts). Invoices are listed in
 *   the app (billing-routing.ts).
 *
 * Relative imports only: scripts/stripe-portal-config.mjs loads this file (jiti).
 */
export const CARD_ONLY_PORTAL_FEATURES = {
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: false },
  subscription_update: { enabled: false },
  customer_update: { enabled: false },
  invoice_history: { enabled: false },
} as const

/** Metadata tag of the dedicated configuration (the script finds it by this tag). */
export const CARD_ONLY_PORTAL_TAG = { freeplug_portal: 'card-only-v1' } as const

export class PortalNotConfiguredError extends Error {
  constructor() {
    super('STRIPE_PORTAL_CONFIGURATION_ID is missing or not a bpc_ id; the billing portal is not opened.')
    this.name = 'PortalNotConfiguredError'
  }
}

export function portalConfigurationId(env: Record<string, string | undefined> = process.env): string | undefined {
  const id = env.STRIPE_PORTAL_CONFIGURATION_ID?.trim()
  return id && /^bpc_[A-Za-z0-9]+$/.test(id) ? id : undefined
}

/** Card-only portal session params. Throws PortalNotConfiguredError without the configuration id. */
export function billingPortalSessionParams(
  customer: string,
  returnUrl: string,
  env: Record<string, string | undefined> = process.env
): {
  customer: string
  return_url: string
  configuration: string
  flow_data: { type: 'payment_method_update'; after_completion: { type: 'redirect'; redirect: { return_url: string } } }
} {
  const configuration = portalConfigurationId(env)
  if (!configuration) throw new PortalNotConfiguredError()
  return {
    customer,
    return_url: returnUrl,
    configuration,
    flow_data: { type: 'payment_method_update', after_completion: { type: 'redirect', redirect: { return_url: returnUrl } } },
  }
}
