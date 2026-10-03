import { describe, expect, it } from 'vitest'
import { billingPortalSessionParams, portalConfigurationId } from './portal'

describe('Billing Portal configuration (hosting ladder)', () => {
  it('passes STRIPE_PORTAL_CONFIGURATION_ID when it is a bpc_ id', () => {
    expect(billingPortalSessionParams('cus_1', 'https://x/dashboard', { STRIPE_PORTAL_CONFIGURATION_ID: ' bpc_123Abc ' })).toEqual({
      customer: 'cus_1',
      return_url: 'https://x/dashboard',
      configuration: 'bpc_123Abc',
    })
  })
  it('falls back to the default configuration when unset or malformed', () => {
    expect(billingPortalSessionParams('cus_1', 'u', {})).toEqual({ customer: 'cus_1', return_url: 'u' })
    expect(portalConfigurationId({ STRIPE_PORTAL_CONFIGURATION_ID: 'price_123' })).toBeUndefined()
    expect(portalConfigurationId({ STRIPE_PORTAL_CONFIGURATION_ID: '' })).toBeUndefined()
  })
})
