import { loadEnvConfig } from '@next/env'
import Stripe from 'stripe'

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

let stripe: Stripe | null = null

function assertStripeSecretKey(key: string) {
  if (key.startsWith('sk_') || key.startsWith('rk_')) return
  if (key.startsWith('mk_')) {
    throw new Error(
      'STRIPE_SECRET_KEY uses an mk_ value — that is not the API secret. In Stripe Dashboard → Developers → API keys, copy the Secret key that starts with sk_test_ or sk_live_ (click Reveal).'
    )
  }
  throw new Error(
    'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_ (Dashboard → Developers → API keys). Do not use pk_ or random IDs.'
  )
}

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY?.trim()
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    assertStripeSecretKey(key)
    stripe = new Stripe(key)
  }
  return stripe
}
