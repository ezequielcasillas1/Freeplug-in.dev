// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CARD_ONLY_PORTAL_FEATURES, CARD_ONLY_PORTAL_TAG, PortalNotConfiguredError, billingPortalSessionParams, portalConfigurationId } from './portal'
import { CARD_ONLY_FEATURES, CARD_ONLY_TAG, cardOnlyPortalConfig, isCardOnly } from '../../../scripts/stripe-portal-config.mjs'
import { desiredPortalConfig } from '../../../scripts/stripe-test-setup-ladder.mjs'

describe('Billing Portal scope: card only (Aria, Oct 3 4:05 PM)', () => {
  it('the dedicated configuration turns on ONLY payment_method_update (no plan, quantity, cancel, customer or invoice features)', () => {
    expect(CARD_ONLY_PORTAL_FEATURES).toEqual({
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: false },
      subscription_update: { enabled: false },
      customer_update: { enabled: false },
      invoice_history: { enabled: false },
    })
    const enabled = Object.entries(CARD_ONLY_PORTAL_FEATURES).filter(([, v]) => v.enabled).map(([k]) => k)
    expect(enabled).toEqual(['payment_method_update'])
  })

  it('the script that creates it in Stripe sends exactly those flags (and the setup script agrees)', () => {
    expect(CARD_ONLY_FEATURES).toEqual(CARD_ONLY_PORTAL_FEATURES)
    expect(CARD_ONLY_TAG).toEqual(CARD_ONLY_PORTAL_TAG)
    const cfg = cardOnlyPortalConfig()
    expect(cfg.features).toEqual(CARD_ONLY_PORTAL_FEATURES)
    expect(cfg).not.toHaveProperty('is_default')
    // no plan or quantity changes anywhere: subscription_update has no products / allowed updates
    expect(cfg.features.subscription_update).toEqual({ enabled: false })
    expect(desiredPortalConfig().features).toEqual(CARD_ONLY_PORTAL_FEATURES)
    // readback check used after create/update
    expect(isCardOnly({ features: CARD_ONLY_PORTAL_FEATURES })).toBe(true)
    expect(isCardOnly({ features: { ...CARD_ONLY_PORTAL_FEATURES, subscription_cancel: { enabled: true } } })).toBe(false)
    expect(isCardOnly({ features: { ...CARD_ONLY_PORTAL_FEATURES, subscription_update: { enabled: true, default_allowed_updates: ['quantity'] } } })).toBe(false)
  })

  it('every session carries the configuration AND a payment_method_update flow that returns to the given URL', () => {
    expect(billingPortalSessionParams('cus_1', 'https://x/dashboard/plans?card=updated', { STRIPE_PORTAL_CONFIGURATION_ID: ' bpc_123Abc ' })).toEqual({
      customer: 'cus_1',
      return_url: 'https://x/dashboard/plans?card=updated',
      configuration: 'bpc_123Abc',
      flow_data: { type: 'payment_method_update', after_completion: { type: 'redirect', redirect: { return_url: 'https://x/dashboard/plans?card=updated' } } },
    })
  })

  it('a missing or malformed configuration id is refused: never the default configuration', () => {
    for (const env of [{}, { STRIPE_PORTAL_CONFIGURATION_ID: '' }, { STRIPE_PORTAL_CONFIGURATION_ID: 'price_123' }, { STRIPE_PORTAL_CONFIGURATION_ID: 'bpc_' }]) {
      expect(() => billingPortalSessionParams('cus_1', 'u', env)).toThrow(PortalNotConfiguredError)
    }
    expect(portalConfigurationId({ STRIPE_PORTAL_CONFIGURATION_ID: 'price_123' })).toBeUndefined()
  })
})
