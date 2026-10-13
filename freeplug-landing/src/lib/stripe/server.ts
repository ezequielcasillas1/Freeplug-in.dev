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

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * Local test stacks only: STRIPE_LOCAL_MOCK_URL sends the Stripe client to a mock on this machine
 * (the e2e stack's Stripe stand-in). Refused unless it points at localhost / 127.0.0.1 / ::1 AND the
 * key is a test key (sk_test_), so it can never redirect live billing. Unset = real Stripe.
 */
export function localStripeMockConfig(
  env: Record<string, string | undefined>
): { host: string; port: number; protocol: 'http' | 'https' } | null {
  const raw = env.STRIPE_LOCAL_MOCK_URL?.trim()
  if (!raw) return null
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error('STRIPE_LOCAL_MOCK_URL is not a valid URL')
  }
  if (!LOOPBACK_HOSTS.has(u.hostname) || (u.protocol !== 'http:' && u.protocol !== 'https:')) {
    throw new Error('STRIPE_LOCAL_MOCK_URL must point at localhost, 127.0.0.1 or ::1')
  }
  if (!env.STRIPE_SECRET_KEY?.trim().startsWith('sk_test_')) {
    throw new Error('STRIPE_LOCAL_MOCK_URL only works with a test key (sk_test_)')
  }
  const protocol = u.protocol === 'https:' ? 'https' : 'http'
  return { host: u.hostname.replace(/^\[|\]$/g, ''), port: Number(u.port || (protocol === 'https' ? 443 : 80)), protocol }
}

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY?.trim()
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    assertStripeSecretKey(key)
    const mock = localStripeMockConfig(process.env)
    stripe = mock ? new Stripe(key, { ...mock, maxNetworkRetries: 0 }) : new Stripe(key)
  }
  return stripe
}
