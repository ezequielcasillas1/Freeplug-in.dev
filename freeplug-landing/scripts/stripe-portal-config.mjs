#!/usr/bin/env node
/**
 * The dedicated card-only Billing Portal configuration (Aria, Oct 3 4:05 PM). TEST MODE ONLY.
 *
 *   node scripts/stripe-portal-config.mjs --env-file <file with STRIPE_SECRET_KEY=sk_test_...> [--dry-run]
 *
 * Creates (or, on a re-run, re-asserts) ONE non-default configuration tagged
 * metadata.freeplug_portal=card-only-v1 with only payment_method_update on; subscription_cancel,
 * subscription_update, customer_update and invoice_history are off. Prints its id: put it in
 * STRIPE_PORTAL_CONFIGURATION_ID (local .env.local, never committed). Without that id the app refuses
 * to open the portal (src/lib/stripe/portal.ts).
 *
 * A live key (sk_live_/rk_live_) or anything but sk_test_/rk_test_ is refused before any request;
 * every object Stripe returns must be livemode=false. The LIVE configuration is created only at
 * launch, with Ezequiel's yes (HOSTING-LADDER-NOTES.md launch checklist).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertTestKey, assertTestObject, readKeyFromEnvFile, redact, SetupRefused, BOT_SECRET_VARS } from './stripe-test-setup-ladder.mjs'

/** Same flags as CARD_ONLY_PORTAL_FEATURES in src/lib/stripe/portal.ts (portal.test.ts keeps them equal). */
export const CARD_ONLY_FEATURES = {
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: false },
  subscription_update: { enabled: false },
  customer_update: { enabled: false },
  invoice_history: { enabled: false },
}
export const CARD_ONLY_TAG = { freeplug_portal: 'card-only-v1' }

export function cardOnlyPortalConfig() {
  return {
    business_profile: { headline: 'Freeplug: update your card' },
    features: CARD_ONLY_FEATURES,
    metadata: CARD_ONLY_TAG,
  }
}

/** True when a configuration Stripe returned has exactly the card-only flags. */
export function isCardOnly(cfg) {
  const f = cfg?.features ?? {}
  return (
    f.payment_method_update?.enabled === true &&
    f.subscription_cancel?.enabled === false &&
    f.subscription_update?.enabled === false &&
    f.customer_update?.enabled === false &&
    f.invoice_history?.enabled === false
  )
}

/** Find-or-create (idempotent). Never touches the account's default configuration. */
export async function ensureCardOnlyPortalConfig(stripe, { dryRun = false, log = console.log } = {}) {
  const all = []
  for await (const c of stripe.billingPortal.configurations.list({ limit: 100 })) all.push(c)
  const mine = all.find((c) => c.metadata?.freeplug_portal === CARD_ONLY_TAG.freeplug_portal && !c.is_default)
  let cfg
  if (mine) {
    assertTestObject(mine, 'portal configuration')
    log(`${dryRun ? 'would update' : 'update'} portal configuration ${mine.id}`)
    cfg = dryRun ? mine : assertTestObject(await stripe.billingPortal.configurations.update(mine.id, { ...cardOnlyPortalConfig(), active: true }), 'portal configuration')
  } else {
    log(`${dryRun ? 'would create' : 'create'} portal configuration (card only, non-default)`)
    if (dryRun) return { id: null, cardOnly: null }
    cfg = assertTestObject(await stripe.billingPortal.configurations.create(cardOnlyPortalConfig()), 'portal configuration')
  }
  if (cfg.is_default) throw new SetupRefused(`${cfg.id} is the default configuration; refusing to use it`)
  return { id: cfg.id, active: cfg.active, cardOnly: isCardOnly(cfg), features: cfg.features }
}

async function main(argv) {
  for (const k of BOT_SECRET_VARS) delete process.env[k]
  const i = argv.indexOf('--env-file')
  const key = assertTestKey(readKeyFromEnvFile(i >= 0 ? argv[i + 1] : undefined))
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(key, { maxNetworkRetries: 2 })
  const r = await ensureCardOnlyPortalConfig(stripe, { dryRun: argv.includes('--dry-run') })
  console.log(JSON.stringify({ id: r.id, active: r.active, cardOnly: r.cardOnly, features: r.features && Object.fromEntries(Object.entries(r.features).map(([k, v]) => [k, v?.enabled])) }, null, 2))
  if (r.id) console.log(`set STRIPE_PORTAL_CONFIGURATION_ID=${r.id} (not a secret)`)
  if (r.id && !r.cardOnly) process.exitCode = 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(redact(e instanceof SetupRefused ? e.message : `portal config failed: ${e?.type ?? ''} ${e?.code ?? ''} ${String(e?.message ?? e).slice(0, 200)}`))
    process.exit(e instanceof SetupRefused ? 2 : 1)
  })
}
